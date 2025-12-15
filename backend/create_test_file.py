#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Create test Excel file for workflow execution"""
import pandas as pd
import os

# Get current directory (should be backend/)
cwd = os.getcwd()
print(f"Current directory: {cwd}")

# Create input directory
input_dir = os.path.join(cwd, "input")
os.makedirs(input_dir, exist_ok=True)
print(f"Input directory: {input_dir}")

# Create test data
df = pd.DataFrame({
    "发票号码": [f"INV-{i:03d}" for i in range(1, 21)],
    "金额": [5000 + i * 500 for i in range(20)],
    "日期": [f"2024-01-{i+1:02d}" for i in range(20)]
})

# Save to Excel
file_path = os.path.join(input_dir, "invoice_demo.xlsx")
df.to_excel(file_path, index=False)

print(f"Test file created: {file_path}")
print(f"File exists: {os.path.exists(file_path)}")
print(f"File size: {os.path.getsize(file_path)} bytes")
print(f"\nData preview:")
print(df.head())
