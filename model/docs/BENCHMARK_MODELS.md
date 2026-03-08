# SRA-Pro Benchmark Models

This document describes the five LLMs selected for the SRA-Pro benchmarking study. Each model is fine-tuned using Supervised Fine-Tuning (SFT) with QLoRA on the same 69-record training dataset. The goal is to determine which model best learns to generate structured, IEEE 830-compliant Software Requirements Analysis documents.

---

## Overview

| Model | Developer | Architecture | Parameters | Context | Script |
|---|---|---|---|---|---|
| DeepSeek-V4 | DeepSeek AI | MLA + MoE | ~671B | 128K | `train_deepseek.py` |
| GLM-5-Reasoning | ZhipuAI (THUDM) | PrefixLM + RLHF | ~130B | 128K | `train_glm.py` |
| Kimi-K2.5 | Moonshot AI | Dense Transformer | ~70B | 200K | `train_kimi.py` |
| Llama-4-Maverick | Meta | Dense + FlashAttn | ~70B | 64K | `train_llama.py` |
| Qwen-3.5-397B | Alibaba Cloud | MoE | ~397B | 64K | `train_qwen.py` |

---

## 1. 🦈 DeepSeek-V4

**Script:** [`benchmarks/train_deepseek.py`](../benchmarks/train_deepseek.py)

### Why DeepSeek-V4?
DeepSeek-V4 represents a frontier-class open-weights model combining two radical architecture changes: **Multi-head Latent Attention (MLA)** for memory-efficient inference and a **Mixture-of-Experts (MoE)** FFN that routes each token to a subset of specialized sub-networks. This combination allows it to achieve GPT-4 level reasoning at a fraction of the inference cost. For the SRA task—which requires structured, multi-section document generation with high semantic precision—MoE's specialization is hypothesized to be a significant advantage.

### Architecture Details
- **MLA (Multi-head Latent Attention):** Instead of caching full Key-Value pairs, MLA compresses them into a latent space, drastically reducing VRAM requirements for long contexts. This is critical for SRA documents which can span tens of thousands of tokens.
- **MoE FFN:** Sparse activation means only a small subset of 256 routed experts are active per token. This gives the model massive effective capacity without proportional compute cost.

### Fine-Tuning Strategy
| Parameter | Value | Rationale |
|---|---|---|
| LoRA Rank (`r`) | 64 | Balances adaptation capacity vs. parameter count |
| LoRA Alpha | 128 | 2x rank for stable gradient scaling |
| Target Modules | `q_proj`, `kv_b_proj`, `q_b_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` | Targets both MLA-specific layers (`kv_b_proj`, `q_b_proj`) and standard FFN projections |
| Learning Rate | 1.5e-4 | Slightly lower than standard to stabilize MoE router during fine-tuning |
| Max Seq Length | 65,536 | Full output SRA documents can be very long |
| Optimizer | `paged_adamw_8bit` | Memory-efficient for large models |

---

## 2. 🧠 GLM-5-Reasoning

**Script:** [`benchmarks/train_glm.py`](../benchmarks/train_glm.py)

### Why GLM-5-Reasoning?
The GLM (General Language Model) series from ZhipuAI/THUDM uses a unique **PrefixLM** architecture with **autoregressive blank infilling** objectives, making it fundamentally different from decoder-only models. GLM-5 adds a dedicated reasoning mode, hypothesized to be beneficial for systematic tasks like SRA generation that require logical deduction from project descriptions. It also represents a non-Western LLM lineage, providing diversity in the benchmark's training signal sources.

### Architecture Details
- **PrefixLM:** Treats part of the input as a "prefix" with bidirectional attention (like BERT) and the rest with causal attention, giving it a hybrid understanding advantage over pure decoder-only models.
- **Reasoning Mode:** Specialized pre-training on chain-of-thought reasoning datasets, allowing it to introspect on requirements before generating structured output.

### Fine-Tuning Strategy
| Parameter | Value | Rationale |
|---|---|---|
| LoRA Rank (`r`) | 64 | Standard for this parameter class |
| Target Modules | `query_key_value`, `dense`, `dense_h_to_4h`, `dense_4h_to_h` | GLM uses a fused QKV projection, unlike separate `q_proj`/`k_proj`/`v_proj` |
| Padding Side | `left` | GLM's native preference for proper attention masking |
| `empty_init` | `False` | Optimization flag specific to GLM to prevent weight initialization issues |
| Learning Rate | 1e-4 | Standard stable rate |

> **Key Difference:** GLM's LoRA targets are distinct from all other models due to its unique fused-attention architecture.

---

## 3. 🌖 Kimi-K2.5

**Script:** [`benchmarks/train_kimi.py`](../benchmarks/train_kimi.py)

### Why Kimi-K2.5?
Kimi (from Moonshot AI) is renowned for its **extreme long-context capabilities** (up to 200K tokens natively). For the SRA task, this is particularly relevant: the input is a raw project document that can be lengthy, and the output is a dense, structured SRA report. Kimi's long-context pre-training should give it an edge in **faithfully extracting and restructuring** all requirement details without losing context mid-document.

### Architecture Details
- **Long Context Training:** Pre-trained with special attention mechanisms (likely RoPE extensions or sliding window attention) explicitly for 200K token contexts.
- **Dense Architecture:** Unlike DeepSeek and Qwen, Kimi uses a standard dense transformer, making its behaviour more predictable and the fine-tuning more straightforward.

### Fine-Tuning Strategy
| Parameter | Value | Rationale |
|---|---|---|
| LoRA Rank (`r`) | 64 | Standard |
| Target Modules | Standard Llama-compat: `q_proj`, `k_proj`, `v_proj`, `o_proj`, etc. | Kimi's architecture is Llama-compatible |
| Gradient Accumulation | 16 | Higher than average to stabilize gradients over long sequences |
| `warmup_ratio` | 0.05 | Ratio-based warmup to handle variable number of steps gracefully for long sequences |

---

## 4. 🦙 Llama-4-Maverick

**Script:** [`benchmarks/train_llama.py`](../benchmarks/train_llama.py)

### Why Llama-4-Maverick?
Meta's Llama-4 Maverick serves as the **de-facto open-source community baseline**. Its architecture is the most widely benchmarked, has the largest ecosystem of fine-tuning tooling, and has the most predictable behaviour during QLoRA fine-tuning. Including it ensures the benchmark results are grounded and comparable to the broader LLM research community's findings.

### Architecture Details
- **Flash Attention 2:** Enabled via `attn_implementation="flash_attention_2"`, providing up to 2x faster attention computation and reducing VRAM usage—critical for 64K context fine-tuning.
- **GQA (Grouped Query Attention):** Llama 3/4 uses GQA which reduces the number of KV heads, making long-context training more efficient.
- **Standard Decoder-Only:** No MoE routing or special hybrid modes, providing clean benchmark signal.

### Fine-Tuning Strategy
| Parameter | Value | Rationale |
|---|---|---|
| LoRA Rank (`r`) | **128** | Highest rank in the benchmark — Llama benefits from higher-rank adaptation for complex structured tasks |
| LoRA Alpha | **256** | Proportionally scaled to double the rank |
| LoRA Dropout | 0.01 | Very low—Llama's strong base representations need less regularization |
| Max Steps | **200** | More steps than other models, as Llama's training is more stable and benefits from longer training |
| Optimizer | `paged_adamw_32bit` | Higher precision optimizer vs. the 8-bit variant used by others, for Llama's clean gradient landscape |

> **Key Difference:** Llama-4 uses the **highest LoRA rank (128)** and longest training (**200 steps**) in the benchmark, reflecting its role as the high-quality baseline.

---

## 5. 🏮 Qwen-3.5-397B

**Script:** [`benchmarks/train_qwen.py`](../benchmarks/train_qwen.py)

### Why Qwen-3.5-397B?
Qwen-3.5-397B is Alibaba's largest open model and another MoE-based giant, similar to DeepSeek-V4 in scale. Its inclusion creates a direct **MoE-vs-MoE comparison** between two different MoE implementations (DeepSeek's MLA-enhanced MoE vs. Qwen's standard MoE), while also testing whether sheer scale (397B routed parameters) translates to better SRA document quality. Qwen also natively supports **ChatML formatting**, which is the de-facto standard for instruction fine-tuning.

### Architecture Details
- **MoE at Scale:** At 397B total parameters with sparse activation, a 4-bit quantized Qwen-3.5 requires careful memory management. The `device_map="auto"` allows distribution across all available GPUs.
- **ChatML Template:** Uses the `<|im_start|>` / `<|im_end|>` token format, which is natively supported by the tokenizer's `apply_chat_template`.

### Fine-Tuning Strategy
| Parameter | Value | Rationale |
|---|---|---|
| LoRA Rank (`r`) | 64 | Standard for MoE models |
| Gradient Accumulation | **16** | Highest in the benchmark (tied with Kimi) — necessary for simulating large batch sizes without OOM on a 397B model |
| Learning Rate | **2e-4** | Highest in the benchmark — MoE models with sparse gradients can be trained with a slightly higher LR |
| `warmup_ratio` | 0.03 | Standard 3% warmup |

> **Key Difference:** Qwen-3.5 uses the **highest learning rate (2e-4)** and the **highest gradient accumulation (16 steps)**, reflecting the unique optimization dynamics of a 397B MoE model.

---

## Training Stack

All five models share a common fine-tuning infrastructure:

| Component | Library | Purpose |
|---|---|---|
| Quantization | `bitsandbytes` (QLoRA) | 4-bit NF4 quantization to reduce VRAM for multi-billion parameter models |
| Adapter Training | `peft` (LoRA) | Parameter-efficient fine-tuning — only adapters are trained, not the full model |
| SFT Loop | `trl` (SFTTrainer) | Supervised Fine-Tuning with packed sequences for efficiency |
| Experiment Tracking | `wandb` | Loss curves, training metrics, and run comparison across all 5 models |
| Precision | `bfloat16` | Standard for modern LLM training — better numerical stability than float16 |

## Evaluation Criteria

After training, each model is evaluated on the 10-record **blind test set** (`test_sft.jsonl`) across these dimensions:

1. **JSON Validity** — Does the output parse as valid JSON?
2. **IEEE 830 Schema Adherence** — Does the output contain all 7 required sections?
3. **Mermaid Syntax Correctness** — Do all generated diagrams render without errors?
4. **Requirement Completeness** — Are all explicitly stated requirements from the input captured?
5. **Hallucination Rate** — Are there requirements in the output not present in the input?

The model achieving the best aggregate score across these five dimensions will be selected as **SRA-Pro**.
