import { clamp } from '../core/geometry.js';
import {
  createLayerGroup,
  addLayerGroup,
  removeLayerGroup,
  moveLayerIntoGroup,
  moveLayerGroupIntoGroup,
  removeLayer,
  duplicateLayer,
  isLayerLocked,
  isGroupLocked,
} from '../core/state.js';

export function createLayerGroupCommandController({
  state,
  transaction,
  ui,
} = {}) {
  if (typeof state?.getDocument !== 'function') {
    throw new TypeError('layer/group command state bridge is required');
  }
  if (
    typeof transaction?.commit !== 'function' ||
    typeof transaction?.blockPendingEdit !== 'function'
  ) {
    throw new TypeError('layer/group command transaction bridge is required');
  }
  if (typeof ui?.showModal !== 'function') {
    throw new TypeError('layer/group command UI bridge is required');
  }

  const blendOptions = [
    ['pass-through', 'Пропускать (Pass Through)'],
    ['source-over', 'Обычный (Normal)'],
    ['multiply', 'Умножение'],
    ['screen', 'Экран'],
    ['overlay', 'Перекрытие'],
    ['soft-light', 'Мягкий свет'],
    ['hard-light', 'Жёсткий свет'],
    ['darken', 'Затемнение'],
    ['lighten', 'Осветление'],
    ['color-dodge', 'Осветление основы'],
    ['color-burn', 'Затемнение основы'],
    ['difference', 'Разница'],
    ['exclusion', 'Исключение'],
  ];

  function activeDocument(owner) {
    return Boolean(owner) && state.getDocument() === owner;
  }

  function exactLayer(owner, layerId) {
    if (!activeDocument(owner) || !layerId) return null;
    return owner.layers?.find(layer => layer.id === layerId) ?? null;
  }

  function exactGroup(owner, groupId) {
    if (!activeDocument(owner) || !groupId) return null;
    return owner.groups?.find(group => group.id === groupId) ?? null;
  }

  function status(message) {
    ui.setStatus?.(message);
  }

  function publish(owner, label) {
    if (!activeDocument(owner)) return false;
    transaction.commit(label);
    return true;
  }

  function layerGroupIsLocked(owner, layer) {
    if (!layer?.groupId) return false;
    const group = owner.groups?.find(item => item.id === layer.groupId) ?? null;
    return Boolean(group && isGroupLocked(owner, group));
  }

  function groupAncestorIsLocked(owner, group) {
    if (!group?.parentGroupId) return false;
    const parent = owner.groups?.find(item => item.id === group.parentGroupId) ?? null;
    return Boolean(parent && isGroupLocked(owner, parent));
  }

  function commandToggleLayerVisibility(owner, layerId) {
    const layer = exactLayer(owner, layerId);
    if (!layer) return false;
    layer.visible = !layer.visible;
    return publish(owner, layer.visible ? 'Показать слой' : 'Скрыть слой');
  }

  function commandToggleLayerLock(owner, layerId) {
    const layer = exactLayer(owner, layerId);
    if (!layer) return false;
    if (layerGroupIsLocked(owner, layer)) {
      status('Слой заблокирован группой');
      return false;
    }
    layer.locked = !layer.locked;
    return publish(owner, layer.locked ? 'Заблокировать слой' : 'Разблокировать слой');
  }

  function commandDeleteLayer(owner, layerId) {
    if (!activeDocument(owner) || transaction.blockPendingEdit()) return false;
    const layer = exactLayer(owner, layerId);
    if (!layer) return false;
    if (isLayerLocked(owner, layer)) {
      status('Слой или его группа заблокированы');
      return false;
    }
    if (!removeLayer(owner, layer.id)) return false;
    return publish(owner, 'Удалить слой');
  }

  function commandDuplicateLayer(owner, layerId) {
    const layer = exactLayer(owner, layerId);
    if (!layer) return false;
    if (isLayerLocked(owner, layer)) {
      status('Слой или его группа заблокированы');
      return false;
    }
    if (!duplicateLayer(owner, layer.id)) return false;
    return publish(owner, 'Дублировать слой');
  }

  function commandRenameLayer(owner, layerId) {
    const layer = exactLayer(owner, layerId);
    if (!layer) return false;
    if (isLayerLocked(owner, layer)) {
      status('Слой или его группа заблокированы');
      return false;
    }

    ui.showModal({
      title: 'Переименовать слой',
      fields: [{ name: 'name', label: 'Имя', value: layer.name, required: true }],
      submitLabel: 'Переименовать',
      onSubmit: values => {
        const liveLayer = exactLayer(owner, layerId);
        if (!liveLayer) return true;
        if (isLayerLocked(owner, liveLayer)) {
          status('Слой или его группа заблокированы');
          return true;
        }
        const name = String(values?.name || '').trim();
        if (!name || name === liveLayer.name) return true;
        liveLayer.name = name;
        publish(owner, 'Переименовать слой');
        return true;
      },
    });
    return true;
  }

  function commandToggleGroupVisibility(owner, groupId) {
    const group = exactGroup(owner, groupId);
    if (!group) return false;
    group.visible = group.visible === false;
    return publish(owner, group.visible ? 'Показать группу слоёв' : 'Скрыть группу слоёв');
  }

  function commandToggleGroupLock(owner, groupId) {
    const group = exactGroup(owner, groupId);
    if (!group) return false;
    if (groupAncestorIsLocked(owner, group)) {
      status('Группа заблокирована родительской группой');
      return false;
    }
    group.locked = !group.locked;
    return publish(owner, group.locked ? 'Заблокировать группу слоёв' : 'Разблокировать группу слоёв');
  }

  function commandCreateGroup(owner, parentGroupId = null) {
    if (!activeDocument(owner)) return null;
    const parent = parentGroupId
      ? owner.groups?.find(group => group.id === parentGroupId) ?? null
      : null;
    if (parentGroupId && !parent) {
      status('Родительская группа не найдена');
      return null;
    }
    if (parent && isGroupLocked(owner, parent)) {
      status('Родительская группа заблокирована');
      return null;
    }

    const number = (owner.groups?.length || 0) + 1;
    const group = addLayerGroup(owner, createLayerGroup({
      name: `Группа ${number}`,
      parentGroupId: parent?.id ?? null,
    }));
    if (parent) parent.collapsed = false;
    publish(owner, parent ? 'Новая подгруппа' : 'Новая группа слоёв');
    status(parent
      ? `Создана подгруппа «${group.name}» в «${parent.name}»`
      : `Создана группа «${group.name}». Перетащите на неё нужные слои.`);
    return group;
  }

  function commandRenameGroup(owner, groupId) {
    const group = exactGroup(owner, groupId);
    if (!group) return false;
    if (isGroupLocked(owner, group)) {
      status('Группа или её родитель заблокированы');
      return false;
    }

    ui.showModal({
      title: 'Переименовать группу',
      fields: [{ name: 'name', label: 'Имя', value: group.name, required: true }],
      submitLabel: 'Переименовать',
      onSubmit: values => {
        const liveGroup = exactGroup(owner, groupId);
        if (!liveGroup) return true;
        if (isGroupLocked(owner, liveGroup)) {
          status('Группа или её родитель заблокированы');
          return true;
        }
        const name = String(values?.name || '').trim();
        if (!name || name === liveGroup.name) return true;
        liveGroup.name = name;
        publish(owner, 'Переименовать группу');
        return true;
      },
    });
    return true;
  }

  function commandEditGroupProperties(owner, groupId) {
    const group = exactGroup(owner, groupId);
    if (!group) return false;
    if (isGroupLocked(owner, group)) {
      status('Группа или её родитель заблокированы');
      return false;
    }

    ui.showModal({
      title: 'Параметры группы',
      fields: [
        {
          name: 'blendMode',
          label: 'Режим наложения',
          type: 'select',
          value: group.blendMode || 'pass-through',
          options: blendOptions,
        },
        {
          name: 'opacity',
          label: 'Непрозрачность, %',
          type: 'number',
          value: Math.round(clamp(Number(group.opacity ?? 1), 0, 1) * 100),
          min: 0,
          max: 100,
          step: 1,
          required: true,
        },
      ],
      submitLabel: 'Применить',
      onSubmit: values => {
        const liveGroup = exactGroup(owner, groupId);
        if (!liveGroup) return true;
        if (isGroupLocked(owner, liveGroup)) {
          status('Группа или её родитель заблокированы');
          return true;
        }

        const blendMode = blendOptions.some(([value]) => value === values?.blendMode)
          ? values.blendMode
          : 'pass-through';
        const rawOpacity = Number(values?.opacity);
        const opacity = clamp(
          Number.isFinite(rawOpacity) ? rawOpacity / 100 : Number(liveGroup.opacity ?? 1),
          0,
          1,
        );
        if (
          liveGroup.blendMode === blendMode &&
          Math.abs(Number(liveGroup.opacity ?? 1) - opacity) < 1e-9
        ) {
          return true;
        }

        liveGroup.blendMode = blendMode;
        liveGroup.opacity = opacity;
        publish(owner, 'Параметры группы');
        return true;
      },
    });
    return true;
  }

  function commandDeleteGroup(owner, groupId) {
    const group = exactGroup(owner, groupId);
    if (!group) return false;
    if (isGroupLocked(owner, group)) {
      status('Сначала разблокируйте группу и её родителей');
      return false;
    }
    if (!removeLayerGroup(owner, group.id)) return false;
    publish(owner, 'Удалить группу слоёв');
    status('Группа удалена, содержимое перенесено на уровень выше');
    return true;
  }

  function commandMoveLayerRelative(owner, layerId, targetId, aboveInDisplay) {
    if (!activeDocument(owner) || layerId === targetId) return false;
    const sourceIndex = owner.layers?.findIndex(item => item.id === layerId) ?? -1;
    const targetLayer = owner.layers?.find(item => item.id === targetId) ?? null;
    if (sourceIndex < 0 || !targetLayer) return false;

    const source = owner.layers[sourceIndex];
    if (isLayerLocked(owner, source) || isLayerLocked(owner, targetLayer)) return false;

    const beforeOrder = owner.layers.map(item => item.id);
    const beforeGroupId = source.groupId ?? null;
    owner.layers.splice(sourceIndex, 1);

    const targetIndex = owner.layers.findIndex(item => item.id === targetId);
    if (targetIndex < 0) {
      owner.layers.splice(Math.min(sourceIndex, owner.layers.length), 0, source);
      return false;
    }

    source.groupId = targetLayer.groupId ?? null;
    const insertIndex = aboveInDisplay ? targetIndex + 1 : targetIndex;
    owner.layers.splice(insertIndex, 0, source);

    const changed = beforeGroupId !== (source.groupId ?? null) ||
      beforeOrder.length !== owner.layers.length ||
      beforeOrder.some((id, index) => owner.layers[index]?.id !== id);
    if (!changed) return false;
    return publish(owner, 'Изменить порядок слоёв');
  }

  function commandMoveLayerIntoGroup(owner, layerId, groupId) {
    if (!activeDocument(owner)) return false;
    const target = exactGroup(owner, groupId);
    if (!target || !moveLayerIntoGroup(owner, layerId, groupId)) return false;
    target.collapsed = false;
    return publish(owner, 'Переместить слой в группу');
  }

  function commandMoveGroupIntoGroup(owner, groupId, targetGroupId) {
    if (!activeDocument(owner)) return false;
    const target = exactGroup(owner, targetGroupId);
    if (!target || !moveLayerGroupIntoGroup(owner, groupId, targetGroupId)) return false;
    target.collapsed = false;
    return publish(owner, 'Переместить группу в группу');
  }

  function commandMoveLayerToRoot(owner, layerId) {
    if (!activeDocument(owner)) return false;
    const index = owner.layers?.findIndex(item => item.id === layerId) ?? -1;
    if (index < 0) return false;
    const layer = owner.layers[index];
    if (isLayerLocked(owner, layer)) return false;

    const beforeGroupId = layer.groupId ?? null;
    const alreadyTop = index === owner.layers.length - 1;
    if (beforeGroupId == null && alreadyTop) return false;

    owner.layers.splice(index, 1);
    layer.groupId = null;
    owner.layers.push(layer);
    return publish(owner, 'Вынести слой из группы');
  }

  function commandMoveGroupToRoot(owner, groupId) {
    if (!activeDocument(owner) || !moveLayerGroupIntoGroup(owner, groupId, null)) return false;
    return publish(owner, 'Вынести группу на верхний уровень');
  }

  function selectedCommand(command) {
    const owner = state.getDocument();
    const layerId = owner?.selectedLayerId ?? null;
    if (!owner || !layerId) return false;
    return command(owner, layerId);
  }

  return {
    toggleLayerVisibility: commandToggleLayerVisibility,
    toggleLayerLock: commandToggleLayerLock,
    deleteLayer: commandDeleteLayer,
    duplicateLayer: commandDuplicateLayer,
    renameLayer: commandRenameLayer,
    toggleSelectedLayerVisibility: () => selectedCommand(commandToggleLayerVisibility),
    toggleSelectedLayerLock: () => selectedCommand(commandToggleLayerLock),
    deleteSelectedLayer: () => selectedCommand(commandDeleteLayer),
    duplicateSelectedLayer: () => selectedCommand(commandDuplicateLayer),
    toggleGroupVisibility: commandToggleGroupVisibility,
    toggleGroupLock: commandToggleGroupLock,
    createGroup: commandCreateGroup,
    renameGroup: commandRenameGroup,
    editGroupProperties: commandEditGroupProperties,
    deleteGroup: commandDeleteGroup,
    moveLayerRelative: commandMoveLayerRelative,
    moveLayerIntoGroup: commandMoveLayerIntoGroup,
    moveGroupIntoGroup: commandMoveGroupIntoGroup,
    moveLayerToRoot: commandMoveLayerToRoot,
    moveGroupToRoot: commandMoveGroupToRoot,
  };
}
