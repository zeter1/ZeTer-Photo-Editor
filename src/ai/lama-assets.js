// Pinned public artifacts; executable code is verified before execution.
export const LAMA_ARTIFACTS = Object.freeze([
  {
    "id": "ort.webgpu.min.js",
    "url": "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort.webgpu.min.js",
    "size": 66417,
    "sha256": "7d65dad7eb4564ad98db9924a259af2e2c68ebfbdbf254fa5d728f1c5736e07a"
  },
  {
    "id": "ort-wasm-simd-threaded.asyncify.mjs",
    "url": "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort-wasm-simd-threaded.asyncify.mjs",
    "size": 53057,
    "sha256": "3d1c85995364bb643302fc6fd877a0c3ba5ae72401815e0f24828a53d9191e28"
  },
  {
    "id": "ort-wasm-simd-threaded.asyncify.wasm",
    "url": "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort-wasm-simd-threaded.asyncify.wasm",
    "size": 26781914,
    "sha256": "39f9f0894d478800487ed9f7dbe92618498db320cf55c8e3d89adff8dce658da"
  },
  {
    "id": "lama_512_int8.onnx",
    "url": "https://huggingface.co/g-ronimo/lama/resolve/418036c6b541e526cdbb0bead1ec3a87dabede53/lama_512_int8.onnx",
    "size": 62074990,
    "sha256": "cab19978adc306622fe37ef60d4a52103b99c98141d499c2a2366a7ed1255dbe"
  }
].map(Object.freeze));
