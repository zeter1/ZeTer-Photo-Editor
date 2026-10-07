import { LAMA_ARTIFACTS } from './lama-assets.js';

// SlimSAM ONNX exports, pinned revision. Shared verified ORT bytes; separate cache.
export const SAM_ARTIFACTS=Object.freeze([
  ...LAMA_ARTIFACTS.slice(0,3),
  {id:'slimsam-vision-q8.onnx',url:'https://huggingface.co/Xenova/slimsam-77-uniform/resolve/5850ab45f587c112167512ffef949107115e26a0/onnx/vision_encoder_quantized.onnx',size:8882165,sha256:'cce23c7b2e5d4f330932738fb67ba518e04b0d99ccdd1cccd22a7da4e01f2971'},
  {id:'slimsam-prompt-q8.onnx',url:'https://huggingface.co/Xenova/slimsam-77-uniform/resolve/5850ab45f587c112167512ffef949107115e26a0/onnx/prompt_encoder_mask_decoder_quantized.onnx',size:4903810,sha256:'cb90b279f549d2cab7fd6e20c38522438c65d84bdcca3d2a764cff7d857fdce2'},
].map(Object.freeze));

const SAM2_BASE='https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/resolve/814a066640debee5a91e70aa401fb8e17e030503/onnx/';
export const SAM2_ARTIFACTS=Object.freeze([
  ...LAMA_ARTIFACTS.slice(0,3),
  {id:'sam2-vision.onnx',url:SAM2_BASE+'vision_encoder_quantized.onnx',size:441167,sha256:'8800fdd04b9045cb6060ba8962b83c78ce9bb0976da8f030afa073467a888524'},
  {id:'sam2-vision.onnx_data',url:SAM2_BASE+'vision_encoder_quantized.onnx_data',size:52573088,sha256:'ea1f677596dc82cef0dc317d78135d892f4b26e20a4439f899aa58d84965b324'},
  {id:'sam2-prompt.onnx',url:SAM2_BASE+'prompt_encoder_mask_decoder.onnx',size:213114,sha256:'874414704c5d686db7d206a35f6e15d26563d50c8c4468fccc6739bd7e491dcf'},
  {id:'sam2-prompt.onnx_data',url:SAM2_BASE+'prompt_encoder_mask_decoder.onnx_data',size:20958208,sha256:'e9874d900dd4134ed60eab1e97910327c2419e0b2954485d8fd6e7f1a1470f47'},
].map(Object.freeze));
