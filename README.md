# Ubuntu Appearance GNOME 扩展

一个完全独立的 GNOME Shell 系统外观扩展。目前用于定制 Ubuntu GDM 登录/注销界面以及 Plymouth 开机、关机画面，不依赖其他扩展，也不需要单独安装命令行工具或 helper。

扩展默认优先显示 `~/Pictures/BingWallpaper` 中的图片；该目录不存在时显示系统图片目录。可以在设置页选择其他文件夹，也可以直接选择任意 JPG、PNG 或 WEBP 文件。

## 安装

以普通用户安装并启用：

```bash
./install.sh
gnome-extensions enable ubuntu-appearance@malingxspace.github.com
```

设置背景时扩展通过一次 `pkexec` 认证复制图片、隐藏登录页 Ubuntu Logo、更新 GDM 的 dconf 配置并重新载入配置，不向 `/usr/local` 安装任何文件。扩展会同时更新当前用户的锁定/注销过渡层，并锁定 GDM greeter 的对应配置，避免旧值覆盖。图片路径使用独立参数传递，并会在提权后重新校验。顶部菜单的图片选择器直接使用桌面文件选择门户，不依赖 GNOME Extensions 偏好程序。

扩展管理器的设置页提供“显示顶部面板图标”开关。关闭图标后，仍可从扩展管理器进入设置页选择图片或恢复默认配置。

界面使用系统语言自动切换，当前内置英文和简体中文。顶部菜单采用简短的“选择背景…”和“使用桌面背景”。

“定制开机与关机画面”是默认关闭的独立模块。开启后，应用背景会创建独立 Plymouth 主题、隐藏 Ubuntu Logo，并更新 initramfs。Plymouth 图片会按主屏物理分辨率居中铺满裁切，使构图与 GDM 的 `cover` 效果一致。“隐藏厂商 Logo”是该模块下的独立开关，默认关闭；关闭时会去除 HUAWEI 等固件 Logo 的黑底和黑色边缘，再作为透明图层叠加到自定义壁纸，开启时则移除该图层。修改开关后需重新应用图片。关闭 Plymouth 模块时应用背景不会改动或恢复 Plymouth。点击“恢复默认”才会切回启用模块前保存的系统主题。

启用后，点击顶部面板的墙纸图标：

- `Choose GDM background…`：打开图片选择和预览页面。
- `Use current desktop background`：直接使用当前桌面背景。

设置页还提供“Restore default”，用于恢复 GDM 默认背景。

## 构建压缩包

```bash
./buildzip.sh
```

生成 `ubuntu-appearance@malingxspace.github.com.zip`，这个 ZIP 已包含全部扩展功能。

## 范围

本扩展设置的是开机登录以及注销后显示的 GDM 界面，不是登录后的 GNOME 锁屏界面。锁屏背景由当前用户的 GNOME Shell 管理。
