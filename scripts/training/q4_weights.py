"""Shared by q4_identity.py and swap_weights.py: Gemma 4 E2B weights in the app's ONNX decoder.

The app's decoder (onnx-community/gemma-4-E2B-it-ONNX, decoder_model_merged_q4) stores its linear
layers as 4-bit MatMulNBits weights. This module maps each one to the PyTorch weights it was made
from and computes its bytes, so a trained model can be written into the same graph.
"""
import re

import numpy as np
import onnx
import torch
from onnxruntime.capi._pybind_state import quantize_matmul_4bits

LM = "model.language_model."
PARTS = {
    "attn/q_proj": ["self_attn.q_proj"],
    "attn/k_proj": ["self_attn.k_proj"],
    "attn/v_proj": ["self_attn.v_proj"],
    "attn/o_proj": ["self_attn.o_proj"],
    "mlp/gate_up_proj": ["mlp.gate_proj", "mlp.up_proj"],
    "mlp/down_proj": ["mlp.down_proj"],
    "per_layer/per_layer_input_gate": ["per_layer_input_gate"],
    "per_layer/per_layer_projection": ["per_layer_projection"],
}


def sources(name):
    """PyTorch weights behind one MatMulNBits node, concatenated along the output axis; else None."""
    g = re.fullmatch(r"/model/layers\.(\d+)/(.+)/MatMul_Quant", name)
    if g and g[2] in PARTS:
        return [f"{LM}layers.{g[1]}.{x}.weight" for x in PARTS[g[2]]]
    if name == "/model/per_layer_projection/MatMul_Quant":
        return [f"{LM}per_layer_model_projection.weight"]
    return None  # lm_head is tied to the embeddings, which a LoRA on the layers does not change.


def quant_nodes(model):
    return [n for n in model.graph.node if n.op_type == "MatMulNBits"]


def initializers(model):
    return {t.name: t for t in model.graph.initializer}


def location(t):
    """(offset, length) of an externally stored initializer."""
    ext = {e.key: e.value for e in t.external_data}
    return int(ext.get("offset", 0)), int(ext["length"])


def is_external(t):
    return t.data_location == onnx.TensorProto.EXTERNAL


def compute(node, weights):
    """(packed, scales, zero points) of a node, from (out, in) PyTorch matrices."""
    a = {x.name: x.i for x in node.attribute}
    block, K, N = a["block_size"], a["K"], a["N"]
    # A real row-major copy: W.T is a Fortran-ordered view and the C++ kernel reads the buffer
    # as row-major, which silently scrambles every block.
    A = np.array(torch.cat(weights, 0).float().numpy().T, order="C")
    if A.shape != (K, N):
        raise ValueError(f"{node.name}: matrix {A.shape}, node expects {(K, N)}")
    k_blocks = (K + block - 1) // block
    pad = k_blocks * block - K
    if pad:
        A = np.pad(A, ((0, pad), (0, 0)), "constant")
    symmetric = not (len(node.input) > 3 and node.input[3])
    packed = np.zeros((N, k_blocks, (block + 1) // 2), dtype="uint8")
    zero_point = np.zeros((N, (k_blocks + 1) // 2), dtype="uint8")
    scales = np.zeros((N, k_blocks), dtype="float32")
    quantize_matmul_4bits(packed, A, scales, zero_point, block, N, K, symmetric)
    return packed, scales, zero_point
