# AI artifact attribution

The editor downloads public pinned artifacts on explicit installation; photos remain local.

## LaMa model

LaMa: Resolution-robust Large Mask Inpainting with Fourier Convolutions (Suvorov et al.). Original project: https://github.com/advimman/lama. Browser ONNX export/quantization by g-ronimo: https://huggingface.co/g-ronimo/lama/tree/418036c6b541e526cdbb0bead1ec3a87dabede53. The pinned model card declares Apache-2.0: https://huggingface.co/g-ronimo/lama/raw/418036c6b541e526cdbb0bead1ec3a87dabede53/README.md. Model hash/size/input contract is recorded in the canonical AI architecture document and asset descriptors. No model modification or unsupported relicensing is implied.

## SlimSAM background removal

SlimSAM (Wang et al.), Apache-2.0: https://github.com/ZigengWang/SlimSAM. ONNX quantized exports by Xenova: https://huggingface.co/Xenova/slimsam-77-uniform/tree/5850ab45f587c112167512ffef949107115e26a0. Pinned model card license: https://huggingface.co/Xenova/slimsam-77-uniform/raw/5850ab45f587c112167512ffef949107115e26a0/README.md. Encoder/decoder remain unmodified; exact sizes and SHA256 are in `src/ai/sam-assets.js`. Original Segment Anything: https://github.com/facebookresearch/segment-anything (Apache-2.0). Input/output and ownership: [architecture/AI_BACKGROUND_REMOVAL.md](architecture/AI_BACKGROUND_REMOVAL.md).

## SAM 2.1 Hiera Tiny

Meta Segment Anything 2.1 checkpoints/code: [official upstream](https://github.com/facebookresearch/sam2), [upstream Apache-2.0 license](https://github.com/facebookresearch/sam2/blob/main/LICENSE). ONNX community conversion pinned at [814a066640debee5a91e70aa401fb8e17e030503](https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/tree/814a066640debee5a91e70aa401fb8e17e030503). The conversion card does not separately declare a license; upstream checkpoint attribution is preserved without inventing a conversion license. Quantized vision encoder plus full-precision prompt decoder and their external data remain unmodified. Exact size/SHA256 descriptors are in `src/ai/sam-assets.js`. Square preprocessing and tensor contract follow [official Transformers SAM2 documentation](https://huggingface.co/docs/transformers/model_doc/sam2); local externalData follows [ORT Web large-model documentation](https://onnxruntime.ai/docs/tutorials/web/large-models.html).

## ONNX Runtime

Microsoft ONNX Runtime Web 1.30.0, MIT. https://github.com/microsoft/onnxruntime/tree/v1.30.0. Exact runtime hashes are recorded in `src/ai/lama-assets.js`; matching npm package tarball integrity was checked before selecting files.

License from https://raw.githubusercontent.com/microsoft/onnxruntime/v1.30.0/LICENSE:

MIT License

Copyright (c) Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
