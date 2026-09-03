#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -eq 0 ]]; then
    echo "请以普通用户安装 GNOME 扩展。" >&2
    exit 1
fi

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
extension_uuid=ubuntu-appearance@malingxspace.github.com
legacy_uuid=login-background@malingxspace.github.com
extension_root="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$extension_uuid"
legacy_root="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$legacy_uuid"

python3 "$project_dir/scripts/compile_po.py" "$project_dir/po/zh_CN.po" \
    "$project_dir/locale/zh_CN/LC_MESSAGES/login-background.mo"
install -d -m 0755 "$extension_root/schemas" \
    "$extension_root/locale/zh_CN/LC_MESSAGES"
install -m 0644 "$project_dir/metadata.json" "$extension_root/metadata.json"
install -m 0644 "$project_dir/extension.js" "$extension_root/extension.js"
install -m 0644 "$project_dir/prefs.js" "$extension_root/prefs.js"
install -m 0644 "$project_dir/utils.js" "$extension_root/utils.js"
install -m 0644 "$project_dir/stylesheet.css" "$extension_root/stylesheet.css"
install -m 0644 "$project_dir/locale/zh_CN/LC_MESSAGES/login-background.mo" \
    "$extension_root/locale/zh_CN/LC_MESSAGES/"
install -m 0644 "$project_dir/schemas/org.gnome.shell.extensions.login-background.gschema.xml" \
    "$extension_root/schemas/"
glib-compile-schemas "$extension_root/schemas"

if [[ -d "$legacy_root" ]]; then
    rm -rf -- "$legacy_root"
    echo "已移除旧 UUID 的安装副本：$legacy_root"
fi

echo "GNOME 扩展安装完成：$extension_root"
echo "启用命令：gnome-extensions enable $extension_uuid"
