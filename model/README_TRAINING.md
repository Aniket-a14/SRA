# SRA-Pro Training Guide: The Battle of the Models (NVIDIA DGX A100 80GB Edition) 🏆

This directory contains the industrial-grade training infrastructure for **SRA-Pro**, optimized specifically for the **NVIDIA DGX A100 (80GB)** systems at the **LPU NVIDIA AI Data Center**.

## 🌟 The Vision
SRA-Pro is designed to be a "World-Class" **IEEE 830-1998 Architect**. By utilizing a massive **64k context window**, we ensure the model can analyze 100+ page documents and generate perfect, multi-section JSON outputs with Mermaid diagrams in a single pass.

## 📁 Repository Structure
- **`benchmarks/`**: Specialized training scripts for the 5 target LLMs (Llama, DeepSeek, Qwen, GLM, Kimi).
- **`train_sft.jsonl`**: The "Golden" SFT dataset (66 samples, filtered for < 64k tokens).
- **`test_sft.jsonl`**: The blind evaluation set (9 samples).
- **`verify_dataset_quality.js`**: Deep auditor for schema, quality, and Mermaid syntax.
- **`scripts/analyze_dataset_tokens.py`**: Tool to verify context window compliance.

## 💻 Hardware Infrastructure (LPU NVIDIA Lab)
Optimized for **NVIDIA A100 (80GB)**:
- **Max Sequence Length**: **65,536 (64k)** (Covers 100% of the filtered training set).
- **VRAM Utilization**: Targeted at ~75-80GB for maximum efficiency.
- **Precision**: **BF16** (Bfloat16) for stability and performance.
- **Technique**: **4-bit QLoRA** with **Flash Attention 2** and **Gradient Checkpointing**.

## 🚀 Execution Instructions

### 1. Setup Environment
```bash
# Recommended for LPU DGX environment
pip install -r requirements.txt
wandb login
```

### 2. High-Speed Download (Optional but Recommended)
Enable the high-speed downloader for massive models (Qwen-397B, DeepSeek):
```powershell
$env:HF_HUB_ENABLE_HF_TRANSFER=1
```

### 3. Run Validation Audit
Always ensure the dataset is in a "Golden" state:
```bash
python scripts/analyze_dataset_tokens.py
node verify_dataset_quality.js train_sft.jsonl
```

### 4. Execute Benchmarks
| Model Family | Command | Optimization |
| :--- | :--- | :--- |
| **DeepSeek-V4** | `python benchmarks/train_deepseek.py` | MLA Attention + 64k Window |
| **Qwen-3.5-397B** | `python benchmarks/train_qwen.py` | MoE Optimized (397B) + 6k Window |
| **Llama-4** | `python benchmarks/train_llama.py` | High LoRA Rank (128) + 64k Window |
| **GLM-5** | `python benchmarks/train_glm.py` | GLM-Specific Native Template |
| **Kimi-K2.5** | `python benchmarks/train_kimi.py` | Long-Context Specialist Tuning |

## 📊 Monitoring & Champion Selection
Logs: **WandB project: `sra-pro-benchmark`**.
Compare models based on:
1. **Convergence Speed**: Which model learns IEEE 830 formatting fastest?
2. **Structural Accuracy**: Zero-error JSON and Mermaid rendering rate.
3. **Throughput**: Tokens per second in the 80GB VRAM environment.

## 🏁 Evaluation (Phase 4)
The winner of this benchmark will be the core engine for **SRA-Pro Production Deployment**.
