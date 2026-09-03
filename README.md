# Ubuntu Appearance GNOME 扩展

一个完全独立的 GNOME Shell 系统外观扩展。目前用于定制 Ubuntu GDM 登录/注销界面以及 Plymouth 开机、关机画面，不依赖其他扩展，也不需要单独安装命令行工具或 helper。

扩展默认优先显示 `~/Pictures/BingWallpaper` 中的图片；该目录不存在时显示系统图片目录。可以在设置页选择其他文件夹，也可以直接选择任意 JPG、PNG 或 WEBP 文件。

## 安装

以普通用户安装并启用：

```bash
./install.sh
gnome-extensions enable ubuntu-appearance@malingxspace.github.com
```

代码模块边界和依赖方向见 [ARCHITECTURE.md](ARCHITECTURE.md)。

设置背景时扩展通过一次 `pkexec` 认证复制图片、隐藏登录页 Ubuntu Logo、更新 GDM 的 dconf 配置并重新载入配置，不向 `/usr/local` 安装任何文件。扩展会同时更新当前用户的锁定/注销过渡层，并锁定 GDM greeter 的对应配置，避免旧值覆盖。图片路径使用独立参数传递，并会在提权后重新校验。顶部菜单的图片选择器直接使用桌面文件选择门户，不依赖 GNOME Extensions 偏好程序。

扩展管理器“顶部面板”页提供“显示顶部面板图标”开关。关闭图标后，仍可从扩展管理器进入设置页。“设为登录”不会修改桌面壁纸，只有明确执行“设为桌面”时才会更新当前用户的桌面壁纸。

顶部面板以固定宽度显示默认网络连接的下载和上传速度，箭头分别使用低饱和度蓝色和紫色，默认背景透明。网速可独立关闭、放在面板左侧或右侧，并支持字节每秒和比特每秒两种单位。
速率按量级自动调整精度：B/s 显示整数，低于 10 KB/s 显示一位小数，10–999 KB/s 显示整数，MB/s 与 GB/s 显示一位小数。
网速组件只负责展示，不响应点击，也不创建弹出菜单或采集应用流量。

扩展可在后台下载 Bing 每日图片到“下载文件夹”。服务在启动时检查一次，并依据 Bing 的发布时间安排下一次检查；网络失败后每小时重试。Bing 图片页按“下载设置、存储与清理、图片列表”分组，可手动下载最近 1–8 天的图片，也可选择市场、自动分辨率或 UHD，并按保留天数清理本扩展记录的旧图片。图片列表展示所有仍在记录中的图片、收藏状态以及“设为桌面/设为登录/设为开关机”操作；收藏图片不受自动清理期限影响。

设置页按“Bing 图片、背景设置、顶部面板”排列。“背景设置”的当前背景列表可直接更换桌面壁纸、登录界面背景及开关机画面，并分别恢复登录和开关机默认设置。完整内部路径只在悬停提示中展示。应用前图片会复制到扩展的持久目录；打开设置页时，旧版仍直接引用外部文件的桌面壁纸也会自动纳入管理，因此自动清理或手动删除原始 Bing 下载文件不会破坏正在使用的背景。

界面使用系统语言自动切换，当前内置英文和简体中文。顶部菜单提供“打开背景设置”和“随机切换桌面壁纸”。

设置开关机画面会创建独立 Plymouth 主题并更新 initramfs。图片按主屏物理分辨率居中铺满裁切，使构图与 GDM 的 `cover` 效果一致。厂商 Logo 可在设置开关机画面后独立隐藏或恢复，每次操作会立即更新 initramfs，不需要重新应用背景。登录背景和开关机画面分别提供恢复默认操作，互不影响。

启用后，点击顶部面板的墙纸图标：

- `Open background settings`：打开扩展设置页，用于管理桌面、登录和开关机背景。
- `Random desktop wallpaper`：从“下载文件夹”中的 JPG、PNG 或 WEBP 图片随机选择一张，作为当前用户的桌面壁纸；会尽量避开当前壁纸，不需要管理员认证。

设置页分别提供“恢复登录默认”和“恢复开关机默认”。

## 构建压缩包

```bash
./buildzip.sh
```

生成 `ubuntu-appearance@malingxspace.github.com.zip`，这个 ZIP 已包含全部扩展功能。

## 开发与验证

构建脚本会编译 GSettings schema 和简体中文翻译，并将运行时模块、schema 与 locale 一同打包。修改核心逻辑后，可运行不依赖 GNOME Shell 图形会话的 smoke tests：

```bash
node tests/network-monitor-smoke.js
node tests/bing-logic-smoke.js
glib-compile-schemas schemas
GSETTINGS_SCHEMA_DIR="$PWD/schemas" gjs -m tests/managed-image-store-smoke.js
GSETTINGS_SCHEMA_DIR="$PWD/schemas" gjs -m tests/bing-cleanup-smoke.js
gjs -m tests/privileged-script-smoke.js
```

其中 `bing-cleanup-smoke.js` 会写入临时 GSettings 值，须在具有可写用户 dconf 会话的桌面环境中运行。

`install.sh` 会编译安装目录内的 schema；在更新已启用的扩展后，重新登录 GNOME Shell，或在 X11 会话按 <kbd>Alt</kbd>+<kbd>F2</kbd>、输入 `r` 后回车，使 Shell 重新载入扩展。Wayland 会话请注销后重新登录。

## 范围

本扩展设置的是开机登录以及注销后显示的 GDM 界面，不是登录后的 GNOME 锁屏界面。锁屏背景由当前用户的 GNOME Shell 管理。
