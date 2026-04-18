#!/bin/bash
cd "$(dirname "$0")"
PYTHONUNBUFFERED=1 LD_LIBRARY_PATH=/usr/local/lib/ollama/cuda_v12 venv/bin/python main.py
