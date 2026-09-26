const ICC_PROFILE_MAX_BYTES = 4 * 1024 * 1024;

export function createColorManagementController({
  state = {},
  color = {},
  pixels = {},
  io = {},
  render = {},
  ui = {},
  FileCtor = globalThis.File,
} = {}) {
  const { getDocument = () => null, commit = () => {} } = state;
  const {
    sanitizeColorManagement,
    createCmykToSrgbTransform,
    createSrgbToCmykTransform,
    createCmykSoftProofTransform,
    inspectCmykIccProfile,
    inspectDisplayIccProfile,
  } = color;
  const { deserializePixelBufferSource, cmykPixelBufferToRgba8Preview } = pixels;
  const { dataUrlToBytes, bytesToDataUrl, rgbaPixelsToDataUrl } = io;
  const { invalidateImageCache = () => {} } = render;
  const { setStatus = () => {}, toast = () => {}, consoleRef = console } = ui;

  let previewTransformCache = { document:null, source:null, proof:null, display:null, policyKey:'', transform:null };
  let editingTransformCache = { document:null, source:null, policyKey:'', transform:null };

  function profileBytes(profile) {
    return profile?.kind === 'icc' && profile.dataUrl
      ? dataUrlToBytes(profile.dataUrl, { maxBytes:ICC_PROFILE_MAX_BYTES })
      : null;
  }

  function policyKey(documentValue, kind) {
    const policy = sanitizeColorManagement(documentValue.colorManagement);
    return kind+'|'+policy.renderingIntent+'|'+policy.proofRenderingIntent+'|'+policy.displaySpace+'|'+Number(policy.softProofEnabled)+'|'+Number(policy.blackPointCompensation)+'|'+Number(policy.gamutWarningEnabled)+'|'+policy.gamutWarningThreshold;
  }

  function currentCmykPreviewTransform(documentValue = getDocument()) {
    const nextPolicyKey = policyKey(documentValue, 'preview');
    if (
      previewTransformCache.document === documentValue
      && previewTransformCache.source === documentValue.colorProfile
      && previewTransformCache.proof === documentValue.proofProfile
      && previewTransformCache.display === documentValue.displayProfile
      && previewTransformCache.policyKey === nextPolicyKey
      && previewTransformCache.transform
    ) return previewTransformCache.transform;

    const policy = sanitizeColorManagement(documentValue.colorManagement);
    const source = profileBytes(documentValue.colorProfile);
    const proof = profileBytes(documentValue.proofProfile);
    const display = profileBytes(documentValue.displayProfile);
    const transform = policy.softProofEnabled && proof
      ? createCmykSoftProofTransform(source, proof, {
          sourceIntent:policy.renderingIntent,
          intent:policy.proofRenderingIntent,
          blackPointCompensation:policy.blackPointCompensation,
          displayProfileBytes:display,
          gamutWarningThreshold:policy.gamutWarningThreshold,
        })
      : createCmykToSrgbTransform(source, {
          intent:policy.renderingIntent,
          displaySpace:policy.displaySpace,
          displayProfileBytes:display,
          gamutWarningThreshold:policy.gamutWarningThreshold,
        });
    previewTransformCache = {
      document:documentValue,
      source:documentValue.colorProfile,
      proof:documentValue.proofProfile,
      display:documentValue.displayProfile,
      policyKey:nextPolicyKey,
      transform,
    };
    return transform;
  }

  function currentSrgbToCmykTransform(documentValue = getDocument()) {
    const nextPolicyKey = policyKey(documentValue, 'editing');
    if (
      editingTransformCache.document === documentValue
      && editingTransformCache.source === documentValue.colorProfile
      && editingTransformCache.policyKey === nextPolicyKey
      && editingTransformCache.transform
    ) return editingTransformCache.transform;

    const policy = sanitizeColorManagement(documentValue.colorManagement);
    const transform = createSrgbToCmykTransform(profileBytes(documentValue.colorProfile), {
      intent:policy.renderingIntent,
    });
    editingTransformCache = {
      document:documentValue,
      source:documentValue.colorProfile,
      policyKey:nextPolicyKey,
      transform,
    };
    return transform;
  }

  function rgb8ToDocumentCmyk(rgb8, documentValue = getDocument()) {
    const rgb = Array.isArray(rgb8) ? rgb8 : [0,0,0];
    return currentSrgbToCmykTransform(documentValue).apply(
      (Number(rgb[0]) || 0) / 255,
      (Number(rgb[1]) || 0) / 255,
      (Number(rgb[2]) || 0) / 255,
    );
  }

  function invalidateTransformCaches() {
    previewTransformCache = { document:null, source:null, proof:null, display:null, policyKey:'', transform:null };
    editingTransformCache = { document:null, source:null, policyKey:'', transform:null };
  }

  async function rebuildDocumentCmykPreviews(targetDoc, transform) {
    const updates = [];
    const policy = sanitizeColorManagement(targetDoc.colorManagement);
    for (const layer of targetDoc.layers) {
      if (layer.type !== 'raster' || layer.highDepthSource?.model !== 'cmyk') continue;
      const buffer = deserializePixelBufferSource(layer.highDepthSource);
      const rgba = cmykPixelBufferToRgba8Preview(buffer, transform, {
        gamutWarning:policy.gamutWarningEnabled,
      });
      updates.push({
        layer,
        dataUrl:await rgbaPixelsToDataUrl(
          buffer.width,
          buffer.height,
          rgba,
          'CMYK preview «'+(layer.name || 'Без имени')+'»',
        ),
      });
    }
    if (getDocument() !== targetDoc) return false;
    for (const update of updates) {
      const old = update.layer.dataUrl;
      update.layer.dataUrl = update.dataUrl;
      invalidateImageCache(old);
    }
    return true;
  }

  async function updateDocumentColorManagement(patch, options = {}) {
    const targetDoc = getDocument();
    const {
      proofProfile = targetDoc.proofProfile,
      displayProfile = targetDoc.displayProfile,
      historyLabel = 'Изменить CMYK color management',
    } = options;
    const previousPolicy = sanitizeColorManagement(targetDoc.colorManagement);
    const previousProof = targetDoc.proofProfile;
    const previousDisplay = targetDoc.displayProfile;

    targetDoc.colorManagement = sanitizeColorManagement({ ...targetDoc.colorManagement, ...patch });
    targetDoc.proofProfile = proofProfile || null;
    targetDoc.displayProfile = displayProfile || null;
    invalidateTransformCaches();

    const transform = currentCmykPreviewTransform(targetDoc);
    setStatus('CMYK: пересчёт color-managed display preview…');
    try {
      if (!await rebuildDocumentCmykPreviews(targetDoc, transform)) {
        targetDoc.colorManagement = previousPolicy;
        targetDoc.proofProfile = previousProof;
        targetDoc.displayProfile = previousDisplay;
        invalidateTransformCaches();
        setStatus('CMYK preview отменён: активный документ изменился');
        return false;
      }
    } catch (error) {
      targetDoc.colorManagement = previousPolicy;
      targetDoc.proofProfile = previousProof;
      targetDoc.displayProfile = previousDisplay;
      invalidateTransformCaches();
      throw error;
    }

    commit(historyLabel);
    const policy = sanitizeColorManagement(targetDoc.colorManagement);
    const displayLabel = targetDoc.displayProfile
      ? 'ICC '+(targetDoc.displayProfile.name || 'RGB')
      : policy.displaySpace.toUpperCase();
    const proofLabel = policy.softProofEnabled && targetDoc.proofProfile
      ? ' • soft proof '+(targetDoc.proofProfile.name || 'ICC')+' ('+policy.proofRenderingIntent+')'
      : '';
    const bpc = policy.softProofEnabled && targetDoc.proofProfile
      ? (policy.blackPointCompensation ? ' • BPC on' : ' • BPC off')
      : '';
    const gamut = policy.gamutWarningEnabled ? ' • gamut warning ΔE>'+policy.gamutWarningThreshold : '';
    setStatus('CMYK display: '+policy.renderingIntent+' → '+displayLabel+proofLabel+bpc+gamut+(transform.warning ? ' • '+transform.warning : ''));
    if (transform.warning) toast('CMYK preview пересчитан с ограничением ICC transform', 'warn');
    return true;
  }

  async function updateDocumentRenderingIntent(intent) {
    return updateDocumentColorManagement(
      { renderingIntent:intent },
      { historyLabel:'Изменить CMYK rendering intent' },
    );
  }

  async function updateDocumentProofRenderingIntent(intent) {
    return updateDocumentColorManagement(
      { proofRenderingIntent:intent },
      { historyLabel:'Изменить soft-proof rendering intent' },
    );
  }

  async function setDocumentSoftProofEnabled(enabled) {
    if (enabled && !getDocument().proofProfile) {
      toast('Сначала загрузите CMYK ICC proof profile', 'warn');
      return false;
    }
    return updateDocumentColorManagement(
      { softProofEnabled:Boolean(enabled) },
      { historyLabel:enabled ? 'Включить soft proof' : 'Отключить soft proof' },
    );
  }

  async function setDocumentBlackPointCompensation(enabled) {
    return updateDocumentColorManagement(
      { blackPointCompensation:Boolean(enabled) },
      { historyLabel:'Изменить Black Point Compensation' },
    );
  }

  async function setDocumentGamutWarningEnabled(enabled) {
    return updateDocumentColorManagement(
      { gamutWarningEnabled:Boolean(enabled) },
      { historyLabel:enabled ? 'Включить gamut warning' : 'Отключить gamut warning' },
    );
  }

  async function setDocumentGamutWarningThreshold(value) {
    return updateDocumentColorManagement(
      { gamutWarningThreshold:Number(value) },
      { historyLabel:'Изменить gamut-warning threshold' },
    );
  }

  async function loadDocumentProofProfile(file) {
    if (!(file instanceof FileCtor) || !file.size) return false;
    if (file.size > ICC_PROFILE_MAX_BYTES) throw new Error('ICC proof profile превышает лимит 4 МБ');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = inspectCmykIccProfile(bytes);
    if (info.colorSpace !== 'CMYK') throw new Error('Proof profile должен быть CMYK ICC profile');
    const profile = {
      kind:'icc', untagged:false,
      dataUrl:bytesToDataUrl(bytes, 'application/vnd.iccprofile'),
      name:file.name.slice(0,240), version:'', deviceClass:'',
      colorSpace:'CMYK', pcs:info.pcs, signatureValid:true,
    };
    return updateDocumentColorManagement(
      { softProofEnabled:true },
      { proofProfile:profile, historyLabel:'Загрузить soft proof ICC profile' },
    );
  }

  async function removeDocumentProofProfile() {
    if (!getDocument().proofProfile) return false;
    return updateDocumentColorManagement(
      { softProofEnabled:false },
      { proofProfile:null, historyLabel:'Удалить soft proof ICC profile' },
    );
  }

  async function loadDocumentDisplayProfile(file) {
    if (!(file instanceof FileCtor) || !file.size) return false;
    if (file.size > ICC_PROFILE_MAX_BYTES) throw new Error('Display ICC profile превышает лимит 4 МБ');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = inspectDisplayIccProfile(bytes);
    const profile = {
      kind:'icc', untagged:false,
      dataUrl:bytesToDataUrl(bytes, 'application/vnd.iccprofile'),
      name:file.name.slice(0,240), version:'', deviceClass:'mntr',
      colorSpace:'RGB', pcs:info.pcs, signatureValid:true,
    };
    return updateDocumentColorManagement(
      {},
      { displayProfile:profile, historyLabel:'Загрузить display ICC profile' },
    );
  }

  async function removeDocumentDisplayProfile() {
    if (!getDocument().displayProfile) return false;
    return updateDocumentColorManagement(
      {},
      { displayProfile:null, historyLabel:'Удалить display ICC profile' },
    );
  }

  function bindControls(root) {
    const intent = root?.querySelector('[data-cmyk-rendering-intent]');
    if (intent) intent.addEventListener('change', async () => {
      intent.disabled = true;
      try { await updateDocumentRenderingIntent(intent.value); }
      catch (error) {
        consoleRef.error(error);
        toast('Не удалось пересчитать CMYK preview', 'error');
        setStatus('Ошибка CMYK color management: '+error.message);
      } finally { if (intent.isConnected) intent.disabled = false; }
    });
    const proofIntent = root?.querySelector('[data-cmyk-proof-intent]');
    if (proofIntent) proofIntent.addEventListener('change', async () => {
      proofIntent.disabled = true;
      try { await updateDocumentProofRenderingIntent(proofIntent.value); }
      catch (error) { consoleRef.error(error); toast('Не удалось изменить proof intent', 'error'); }
      finally { if (proofIntent.isConnected) proofIntent.disabled = false; }
    });
    const proofToggle = root?.querySelector('[data-cmyk-soft-proof]');
    if (proofToggle) proofToggle.addEventListener('change', async () => {
      proofToggle.disabled = true;
      try { await setDocumentSoftProofEnabled(proofToggle.checked); }
      catch (error) { consoleRef.error(error); toast(error.message || 'Ошибка soft proof', 'error'); }
      finally { if (proofToggle.isConnected) proofToggle.disabled = false; }
    });
    const bpc = root?.querySelector('[data-cmyk-bpc]');
    if (bpc) bpc.addEventListener('change', async () => {
      bpc.disabled = true;
      try { await setDocumentBlackPointCompensation(bpc.checked); }
      catch (error) { consoleRef.error(error); toast(error.message || 'Ошибка BPC', 'error'); }
      finally { if (bpc.isConnected) bpc.disabled = false; }
    });
    const gamut = root?.querySelector('[data-cmyk-gamut-warning]');
    if (gamut) gamut.addEventListener('change', async () => {
      gamut.disabled = true;
      try { await setDocumentGamutWarningEnabled(gamut.checked); }
      catch (error) { consoleRef.error(error); toast(error.message || 'Ошибка gamut warning', 'error'); }
      finally { if (gamut.isConnected) gamut.disabled = false; }
    });
    const threshold = root?.querySelector('[data-cmyk-gamut-threshold]');
    if (threshold) threshold.addEventListener('change', async () => {
      threshold.disabled = true;
      try { await setDocumentGamutWarningThreshold(threshold.value); }
      catch (error) { consoleRef.error(error); toast(error.message || 'Ошибка gamut threshold', 'error'); }
      finally { if (threshold.isConnected) threshold.disabled = false; }
    });
    const proofFile = root?.querySelector('[data-cmyk-proof-file]');
    if (proofFile) proofFile.addEventListener('change', async () => {
      const selected = proofFile.files?.[0];
      if (!selected) return;
      proofFile.disabled = true;
      try { await loadDocumentProofProfile(selected); }
      catch (error) {
        consoleRef.error(error);
        toast(error.message || 'Не удалось открыть ICC proof profile', 'error');
        setStatus('Ошибка soft proof ICC: '+error.message);
      } finally { if (proofFile.isConnected) proofFile.disabled = false; }
    });
    const displayFile = root?.querySelector('[data-cmyk-display-file]');
    if (displayFile) displayFile.addEventListener('change', async () => {
      const selected = displayFile.files?.[0];
      if (!selected) return;
      displayFile.disabled = true;
      try { await loadDocumentDisplayProfile(selected); }
      catch (error) {
        consoleRef.error(error);
        toast(error.message || 'Не удалось открыть display ICC profile', 'error');
        setStatus('Ошибка display ICC: '+error.message);
      } finally { if (displayFile.isConnected) displayFile.disabled = false; }
    });
    root?.querySelector('[data-cmyk-proof-remove]')?.addEventListener('click', () => {
      removeDocumentProofProfile().catch(error => {
        consoleRef.error(error);
        toast(error.message || 'Ошибка удаления proof profile', 'error');
      });
    });
    root?.querySelector('[data-cmyk-display-remove]')?.addEventListener('click', () => {
      removeDocumentDisplayProfile().catch(error => {
        consoleRef.error(error);
        toast(error.message || 'Ошибка удаления display profile', 'error');
      });
    });
  }

  return {
    profileBytes,
    currentCmykPreviewTransform,
    currentSrgbToCmykTransform,
    rgb8ToDocumentCmyk,
    invalidateTransformCaches,
    rebuildDocumentCmykPreviews,
    updateDocumentColorManagement,
    updateDocumentRenderingIntent,
    updateDocumentProofRenderingIntent,
    setDocumentSoftProofEnabled,
    setDocumentBlackPointCompensation,
    setDocumentGamutWarningEnabled,
    setDocumentGamutWarningThreshold,
    loadDocumentProofProfile,
    removeDocumentProofProfile,
    loadDocumentDisplayProfile,
    removeDocumentDisplayProfile,
    bindControls,
  };
}
