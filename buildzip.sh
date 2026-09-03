#!/usr/bin/env bash
set -euo pipefail

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$project_dir"
glib-compile-schemas schemas
python3 scripts/compile_po.py po/zh_CN.po \
    locale/zh_CN/LC_MESSAGES/login-background.mo
rm -f login-background@malingxspace.github.com.zip \
    ubuntu-appearance@malingxspace.github.com.zip
zip -r ubuntu-appearance@malingxspace.github.com.zip \
    metadata.json extension.js prefs.js stylesheet.css src schemas locale
echo "创建：$project_dir/ubuntu-appearance@malingxspace.github.com.zip"
