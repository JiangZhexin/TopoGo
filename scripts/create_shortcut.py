# -*- coding: utf-8 -*-
"""在桌面创建 TopoGo 快捷方式（.lnk），绑定图标与一键启动脚本。"""
import os
import sys

try:
    import win32com.client
except ImportError:
    print("NEED_PYWIN32")
    sys.exit(2)

ws = win32com.client.Dispatch("WScript.Shell")
desktop = ws.SpecialFolders("Desktop")

# 项目根目录 = 本脚本所在目录的上一级（scripts/ 的父目录），不写死本机路径
project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

path = os.path.join(desktop, "TopoGo.lnk")
lnk = ws.CreateShortcut(path)
lnk.TargetPath = os.path.join(project_dir, "TopoGo-Start.bat")
lnk.WorkingDirectory = project_dir
lnk.IconLocation = os.path.join(project_dir, "assets", "topogo.ico") + ",0"
lnk.Description = "TopoGo - start server and play"
lnk.WindowStyle = 7  # minimized launcher window
lnk.Save()
print("OK", path)
