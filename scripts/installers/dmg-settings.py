import os
import plistlib

app = defines['app']
with open(os.path.join(app, 'Contents', 'Info.plist'), 'rb') as source:
    info = plistlib.load(source)

format = 'UDZO'
filesystem = 'HFS+'
files = [app]
symlinks = {'Applications': '/Applications'}
icon = os.path.join(app, 'Contents', 'Resources', info['CFBundleIconFile'] + '.icns')
background = defines['background']
# Changing FinderInfo on the signed app would invalidate strict codesign checks.
window_rect = ((200, 180), (620, 400))
icon_locations = {'SnapSlot.app': (160, 215), 'Applications': (460, 215)}
icon_size = 96
grid_spacing = 80
text_size = 14
default_view = 'icon-view'
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
include_icon_view_settings = True
include_list_view_settings = False
