/*
**  图标
*/
HROS.app = (function(){
	return {
		/*
		**  获得图标排列方式，x横向排列，y纵向排列
		*/
		getXY : function(callback){
			$.ajax({
				type : 'POST',
				url : ajaxUrl,
				data : 'ac=getAppXY'
			}).done(function(i){
				HROS.CONFIG.appXY = i;
				callback && callback();
			});
		},
		/*
		**  更新图标排列方式
		*/
		updateXY : function(i, callback){
			function done(){
				HROS.CONFIG.appXY = i;
				callback && callback();
			}
			if(HROS.base.checkLogin()){
				$.ajax({
					type : 'POST',
					url : ajaxUrl,
					data : 'ac=setAppXY&appxy=' + i
				}).done(function(responseText){
					done();
				});
			}else{
				done();
			}
		},
		/*
		**  获取图标
		*/
		get : function(){
			//绘制图标表格
			var grid = HROS.grid.getAppGrid(), dockGrid = HROS.grid.getDockAppGrid();
			//获取json数组并循环输出每个图标
			$.ajax({
				type : 'POST',
				url : ajaxUrl,
				data : 'ac=getMyApp'
			}).done(function(sc){
				sc = $.parseJSON(sc);
				//加载应用码头图标
				if(sc['dock'] != ''){
					var dock_append = '';
					$(sc['dock']).each(function(i){
						dock_append += appbtnTemp({
							'top' : dockGrid[i]['startY'],
							'left' : dockGrid[i]['startX'],
							'title' : this.name,
							'type' : this.type,
							'id' : 'd_' + this.appid,
							'appid' : this.appid,
							'realappid' : this.realappid,
							'imgsrc' : this.icon
						});
					});
					$('#dock-bar .dock-applist').html('').append(dock_append);
				}
				//加载桌面图标
				for(var j = 1; j <= 5; j++){
					var desk_append = '';
					if(sc['desk' + j] != ''){
						$(sc['desk' + j]).each(function(i){
							desk_append += appbtnTemp({
								'top' : grid[i]['startY'] + 7,
								'left' : grid[i]['startX'] + 16,
								'title' : this.name,
								'type' : this.type,
								'id' : 'd_' + this.appid,
								'appid' : this.appid,
								'realappid' : this.realappid,
								'imgsrc' : this.icon
							});
						});
					}
					desk_append += addbtnTemp({
						'top' : grid[sc['desk' + j].length]['startY'] + 7,
						'left' : grid[sc['desk' + j].length]['startX'] + 16
					});
					$('#desk-' + j + ' li').remove();
					$('#desk-' + j).append(desk_append);
				}
				//绑定'应用市场'图标点击事件
				$('#desk').off('click').on('click', 'li.add', function(){
					HROS.window.createTemp({
						appid : 'hoorayos-yysc',
						title : '应用市场',
						url : 'sysapp/appmarket/index.php',
						width : 800,
						height : 484,
						isflash : false
					});
				});
				//绑定图标拖动事件
				HROS.app.move();
				//绑定应用码头拖动事件
				HROS.dock.move();
				//加载滚动条
				HROS.app.getScrollbar();
				//绑定滚动条拖动事件
				HROS.app.moveScrollbar();
				//绑定图标右击事件
				$('#desk').on('contextmenu', '.appbtn:not(.add)', function(e){
					$('.popup-menu').hide();
					$('.quick_view_container').remove();
					switch($(this).attr('type')){
						case 'app':
						case 'widget':
							var popupmenu = HROS.popupMenu.app($(this));
							break;
						case 'papp':
						case 'pwidget':
							var popupmenu = HROS.popupMenu.papp($(this));
							break;
						case 'folder':
							var popupmenu = HROS.popupMenu.folder($(this));
							break;
					}
					var l = ($(document).width() - e.clientX) < popupmenu.width() ? (e.clientX - popupmenu.width()) : e.clientX;
					var t = ($(document).height() - e.clientY) < popupmenu.height() ? (e.clientY - popupmenu.height()) : e.clientY;
					popupmenu.css({
						left : l,
						top : t
					}).show();
					return false;
				});
			});
		},
		/*
		**  添加应用
		*/
		add : function(id, callback){
			function done(){
				callback && callback();
			}
			if(HROS.base.checkLogin()){
				$.ajax({
					type : 'POST',
					url : ajaxUrl,
					data : 'ac=addMyApp&id=' + id  + '&desk=' + HROS.CONFIG.desk
				}).done(function(responseText){
					done();
				});
			}else{
				done();
			}
		},
		/*
		**  删除应用
		*/
		remove : function(id, callback){
			function done(){
				HROS.widget.removeCookie(id);
				callback && callback();
			}
			if(HROS.base.checkLogin()){
				$.ajax({
					type : 'POST',
					url : ajaxUrl,
					data : 'ac=delMyApp&id=' + id
				}).done(function(responseText){
					done();
				});
			}else{
				done();
			}
		},
		/*
		**  图标拖动、打开
		**  这块代码略多，主要处理了9种情况下的拖动，分别是：
		**  桌面拖动到应用码头、桌面拖动到文件夹内、当前桌面上拖动(排序)
		**  应用码头拖动到桌面、应用码头拖动到文件夹内、应用码头上拖动(排序)
		**  文件夹内拖动到桌面、文件夹内拖动到应用码头、不同文件夹之间拖动
		*/
		move : function(){
			//应用码头图标拖动
			$('#dock-bar .dock-applist').off('mousedown', 'li').on('mousedown', 'li', function(e){
				e.preventDefault();
				e.stopPropagation();
				if(e.button == 0 || e.button == 1){
					var oldobj = $(this), x, y, cx, cy, dx, dy, lay, obj = $('<li id="shortcut_shadow">' + oldobj.html() + '</li>');
					dx = cx = e.clientX;
					dy = cy = e.clientY;
					x = dx - oldobj.offset().left;
					y = dy - oldobj.offset().top;
					//绑定鼠标移动事件
					$(document).on('mousemove', function(e){
						$('body').append(obj);
						lay = HROS.maskBox.desk();
						lay.show();
						cx = e.clientX <= 0 ? 0 : e.clientX >= $(document).width() ? $(document).width() : e.clientX;
						cy = e.clientY <= 0 ? 0 : e.clientY >= $(document).height() ? $(document).height() : e.clientY;
						_l = cx - x;
						_t = cy - y;
						if(dx != cx || dy != cy){
							obj.css({
								left : _l,
								top : _t
							}).show();
						}
					}).on('mouseup', function(){
						$(document).off('mousemove').off('mouseup');
						obj.remove();
						if(typeof(lay) !== 'undefined'){
							lay.hide();
						}
						//判断是否移动图标，如果没有则判断为click事件
						if(dx == cx && dy == cy){
							switch(oldobj.attr('type')){
								case 'app':
								case 'papp':
									HROS.window.create(oldobj.attr('realappid'));
									break;
								case 'widget':
								case 'pwidget':
									HROS.widget.create(oldobj.attr('realappid'));
									break;
								case 'folder':
									HROS.folderView.init(oldobj);
									break;
							}
							return false;
						}
						var folderId = HROS.grid.searchFolderGrid(cx, cy);
						if(folderId != null){
							if(oldobj.hasClass('folder') == false){
								function dockFolderDone(){
									oldobj.remove();
									HROS.deskTop.appresize();
									//如果文件夹预览面板为显示状态，则进行更新
									if($('#qv_' + folderId).length != 0){
										HROS.folderView.init($('#d_' + folderId));
									}
									//如果文件夹窗口为显示状态，则进行更新
									if($('#w_' + folderId).length != 0){
										HROS.window.updateFolder(folderId);
									}
								}
								if(HROS.base.checkLogin()){
									$.ajax({
										type : 'POST',
										url : ajaxUrl,
										data : 'ac=updateMyApp&movetype=dock-folder&id=' + oldobj.attr('appid') + '&to=' + folderId
									}).done(function(responseText){
										dockFolderDone();
									});
								}else{
									dockFolderDone();
								}
							}
						}else{
							var icon, icon2;
							var iconIndex = $('#desk-' + HROS.CONFIG.desk + ' li.appbtn:not(.add)').length == 0 ? -1 : $('#desk-' + HROS.CONFIG.desk + ' li').index(oldobj);
							var iconIndex2 = $('#dock-bar .dock-applist').html() == '' ? -1 : $('#dock-bar .dock-applist li').index(oldobj);
							
							var dock_w2 = HROS.CONFIG.dockPos == 'left' ? 0 : HROS.CONFIG.dockPos == 'top' ? ($(window).width() - $('#dock-bar .dock-applist').width() - 20) / 2 : $(window).width() - $('#dock-bar .dock-applist').width();
							var dock_h2 = HROS.CONFIG.dockPos == 'top' ? 0 : ($(window).height() - $('#dock-bar .dock-applist').height() - 20) / 2;
							icon2 = HROS.grid.searchDockAppGrid(cx - dock_w2, cy - dock_h2);
							if(icon2 != null && icon2 != oldobj.index()){
								function dockDockDone(){
									if(icon2 < iconIndex2){
										$('#dock-bar .dock-applist li:eq(' + icon2 + ')').before(oldobj);
									}else if(icon2 > iconIndex2){
										$('#dock-bar .dock-applist li:eq(' + icon2 + ')').after(oldobj);
									}
									HROS.deskTop.appresize();
								}
								if(HROS.base.checkLogin()){
									$.ajax({
										type : 'POST',
										url : ajaxUrl,
										data : 'ac=updateMyApp&movetype=dock-dock&id=' + oldobj.attr('appid') + '&from=' + oldobj.index() + '&to=' + icon2
									}).done(function(responseText){
										dockDockDone();
									});
								}else{
									dockDockDone();
								}
							}else{
								var dock_w = HROS.CONFIG.dockPos == 'left' ? 73 : 0;
								var dock_h = HROS.CONFIG.dockPos == 'top' ? 73 : 0;
								icon = HROS.grid.searchAppGrid(cx - dock_w, cy - dock_h);
								if(icon != null){
									function dockDeskDone(){
										if(icon < iconIndex){
											$('#desk-' + HROS.CONFIG.desk + ' li:not(.add):eq(' + icon + ')').before(oldobj);
										}else if(icon > iconIndex){
											$('#desk-' + HROS.CONFIG.desk + ' li:not(.add):eq(' + icon + ')').after(oldobj);
										}else{
											if(iconIndex == -1){
												$('#desk-' + HROS.CONFIG.desk + ' li.add').before(oldobj);
											}
										}
										HROS.deskTop.appresize();
									}
									if(HROS.base.checkLogin()){
										$.ajax({
											type : 'POST',
											url : ajaxUrl,
											data : 'ac=updateMyApp&movetype=dock-desk&id=' + oldobj.attr('appid') + '&from=' + oldobj.index() + '&to=' + (icon + 1) + '&desk=' + HROS.CONFIG.desk
										}).done(function(responseText){
											dockDeskDone();
										});
									}else{
										dockDeskDone();
									}
								}
							}
						}
					});
				}
				return false;
			});
			//桌面图标拖动
			$('#desk .desktop-container').off('mousedown', 'li:not(.add)').on('mousedown', 'li:not(.add)', function(e){
				e.preventDefault();
				e.stopPropagation();
				if(e.button == 0 || e.button == 1){
					var oldobj = $(this), x, y, cx, cy, dx, dy, lay, obj = $('<li id="shortcut_shadow">' + oldobj.html() + '</li>');
					dx = cx = e.clientX;
					dy = cy = e.clientY;
					x = dx - oldobj.offset().left;
					y = dy - oldobj.offset().top;
					//绑定鼠标移动事件
					$(document).on('mousemove', function(e){
						$('body').append(obj);
						lay = HROS.maskBox.desk();
						lay.show();
						cx = e.clientX <= 0 ? 0 : e.clientX >= $(document).width() ? $(document).width() : e.clientX;
						cy = e.clientY <= 0 ? 0 : e.clientY >= $(document).height() ? $(document).height() : e.clientY;
						_l = cx - x;
						_t = cy - y;
						if(dx != cx || dy != cy){
							obj.css({
								left : _l,
								top : _t
							}).show();
						}
					}).on('mouseup', function(){
						$(document).off('mousemove').off('mouseup');
						obj.remove();
						if(typeof(lay) !== 'undefined'){
							lay.hide();
						}
						//判断是否移动图标，如果没有则判断为click事件
						if(dx == cx && dy == cy){
							switch(oldobj.attr('type')){
								case 'app':
								case 'papp':
									HROS.window.create(oldobj.attr('realappid'));
									break;
								case 'widget':
								case 'pwidget':
									HROS.widget.create(oldobj.attr('realappid'));
									break;
								case 'folder':
									HROS.folderView.init(oldobj);
									break;
							}
							return false;
						}
						var folderId = HROS.grid.searchFolderGrid(cx, cy);
						if(folderId != null){
							if(oldobj.attr('type') != 'folder'){
								function deskFolderDone(){
									oldobj.remove();
									HROS.deskTop.appresize();
									//如果文件夹预览面板为显示状态，则进行更新
									if($('#qv_' + folderId).length != 0){
										HROS.folderView.init($('#d_' + folderId));
									}
									//如果文件夹窗口为显示状态，则进行更新
									if($('#w_' + folderId).length != 0){
										HROS.window.updateFolder(folderId);
									}
								}
								if(HROS.base.checkLogin()){
									$.ajax({
										type : 'POST',
										url : ajaxUrl,
										data : 'ac=updateMyApp&movetype=desk-folder&id=' + oldobj.attr('appid') + '&from=' + (oldobj.index() - 2) + '&to=' + folderId + '&desk=' + HROS.CONFIG.desk
									}).done(function(responseText){
										deskFolderDone();
									});
								}else{
									deskFolderDone();
								}
							}
						}else{
							var icon, icon2;
							var iconIndex = $('#desk-' + HROS.CONFIG.desk + ' li.appbtn:not(.add)').length == 0 ? -1 : $('#desk-' + HROS.CONFIG.desk + ' li').index(oldobj);
							var iconIndex2 = $('#dock-bar .dock-applist').html() == '' ? -1 : $('#dock-bar .dock-applist li').index(oldobj);
							
							var dock_w2 = HROS.CONFIG.dockPos == 'left' ? 0 : HROS.CONFIG.dockPos == 'top' ? ($(window).width() - $('#dock-bar .dock-applist').width() - 20) / 2 : $(window).width() - $('#dock-bar .dock-applist').width();
							var dock_h2 = HROS.CONFIG.dockPos == 'top' ? 0 : ($(window).height() - $('#dock-bar .dock-applist').height() - 20) / 2;
							icon2 = HROS.grid.searchDockAppGrid(cx - dock_w2, cy - dock_h2);
							if(icon2 != null){
								function deskDockDone(){
									if(icon2 < iconIndex2){
										$('#dock-bar .dock-applist li:eq(' + icon2 + ')').before(oldobj);
									}else if(icon2 > iconIndex2){
										$('#dock-bar .dock-applist li:eq(' + icon2 + ')').after(oldobj);
									}else{
										if(iconIndex2 == -1){
											$('#dock-bar .dock-applist').append(oldobj);
										}
									}
									if($('#dock-bar .dock-applist li').length > 7){
										$('#desk-' + HROS.CONFIG.desk + ' li.add').before($('#dock-bar .dock-applist li').last());
									}
									HROS.deskTop.appresize();
								}
								if(HROS.base.checkLogin()){
									$.ajax({
										type : 'POST',
										url : ajaxUrl,
										data : 'ac=updateMyApp&movetype=desk-dock&id=' + oldobj.attr('appid') + '&from=' + (oldobj.index() - 2) + '&to=' + (icon2 + 1) + '&desk=' + HROS.CONFIG.desk
									}).done(function(responseText){
										deskDockDone();
									});
								}else{
									deskDockDone();
								}
							}else{
								var dock_w = HROS.CONFIG.dockPos == 'left' ? 73 : 0;
								var dock_h = HROS.CONFIG.dockPos == 'top' ? 73 : 0;
								icon = HROS.grid.searchAppGrid(cx - dock_w, cy - dock_h);
								if(icon != null && icon != (oldobj.index() - 2)){
									function deskDeskDone(){
										if(icon < iconIndex){
											$('#desk-' + HROS.CONFIG.desk + ' li:not(.add):eq(' + icon + ')').before(oldobj);
										}else if(icon > iconIndex){
											$('#desk-' + HROS.CONFIG.desk + ' li:not(.add):eq(' + icon + ')').after(oldobj);
										}else{
											if(iconIndex == -1){
												$('#desk-' + HROS.CONFIG.desk + ' li.add').before(oldobj);
											}
										}
										HROS.deskTop.appresize();
									}
									if(HROS.base.checkLogin()){
										$.ajax({
											type : 'POST',
											url : ajaxUrl,
											data : 'ac=updateMyApp&movetype=desk-desk&id=' + oldobj.attr('appid') + '&from=' + (oldobj.index() - 2) + '&to=' + icon + '&desk=' + HROS.CONFIG.desk
										}).done(function(responseText){
											deskDeskDone();
										});
									}else{
										deskDeskDone();
									}
								}
							}
						}
					});
				}
			});
			//文件夹内图标拖动
			$('.folder_body, .quick_view_container').off('mousedown', 'li').on('mousedown', 'li', function(e){
				e.preventDefault();
				e.stopPropagation();
				if(e.button == 0 || e.button == 1){
					var oldobj = $(this), x, y, cx, cy, dx, dy, lay, obj = $('<li id="shortcut_shadow">' + oldobj.html() + '</li>');
					dx = cx = e.clientX;
					dy = cy = e.clientY;
					x = dx - oldobj.offset().left;
					y = dy - oldobj.offset().top;
					//绑定鼠标移动事件
					$(document).on('mousemove', function(e){
						$('body').append(obj);
						lay = HROS.maskBox.desk();
						lay.show();
						cx = e.clientX <= 0 ? 0 : e.clientX >= $(document).width() ? $(document).width() : e.clientX;
						cy = e.clientY <= 0 ? 0 : e.clientY >= $(document).height() ? $(document).height() : e.clientY;
						_l = cx - x;
						_t = cy - y;
						if(dx != cx || dy != cy){
							obj.css({
								left : _l,
								top : _t
							}).show();
						}
					}).on('mouseup', function(){
						$(document).off('mousemove').off('mouseup');
						obj.remove();
						if(typeof(lay) !== 'undefined'){
							lay.hide();
						}
						//判断是否移动图标，如果没有则判断为click事件
						if(dx == cx && dy == cy){
							switch(oldobj.attr('type')){
								case 'app':
								case 'papp':
									HROS.window.create(oldobj.attr('realappid'));
									break;
								case 'widget':
								case 'pwidget':
									HROS.widget.create(oldobj.attr('realappid'));
									break;
							}
							return false;
						}
						var folderId = HROS.grid.searchFolderGrid(cx, cy);
						if(folderId != null){
							if(oldobj.parents('.folder-window').attr('appid') != folderId){
								function folderFolderDone(){
									oldobj.remove();
									HROS.deskTop.appresize();
									//如果文件夹预览面板为显示状态，则进行更新
									if($('#qv_' + folderId).length != 0){
										HROS.folderView.init($('#d_' + folderId));
									}
									//如果文件夹窗口为显示状态，则进行更新
									if($('#w_' + folderId).length != 0){
										HROS.window.updateFolder(folderId);
									}
								}
								if(HROS.base.checkLogin()){
									$.ajax({
										type : 'POST',
										url : ajaxUrl,
										data : 'ac=updateMyApp&movetype=folder-folder&id=' + oldobj.attr('appid') + '&to=' + folderId
									}).done(function(responseText){
										folderFolderDone();
									});
								}else{
									folderFolderDone();
								}
							}
						}else{
							var icon, icon2;
							var iconIndex = $('#desk-' + HROS.CONFIG.desk + ' li.appbtn:not(.add)').length == 0 ? -1 : $('#desk-' + HROS.CONFIG.desk + ' li').index(oldobj);
							var iconIndex2 = $('#dock-bar .dock-applist').html() == '' ? -1 : $('#dock-bar .dock-applist li').index(oldobj);
							
							var dock_w2 = HROS.CONFIG.dockPos == 'left' ? 0 : HROS.CONFIG.dockPos == 'top' ? ($(window).width() - $('#dock-bar .dock-applist').width() - 20) / 2 : $(window).width() - $('#dock-bar .dock-applist').width();
							var dock_h2 = HROS.CONFIG.dockPos == 'top' ? 0 : ($(window).height() - $('#dock-bar .dock-applist').height() - 20) / 2;
							icon2 = HROS.grid.searchDockAppGrid(cx - dock_w2, cy - dock_h2);
							if(icon2 != null){
								function folderDockDone(){
									var folderId = oldobj.parents('.folder-window').attr('appid');
									if(icon2 < iconIndex2){
										$('#dock-bar .dock-applist li.appbtn:not(.add):eq(' + icon2 + ')').before(oldobj);
									}else if(icon2 > iconIndex2){
										$('#dock-bar .dock-applist li.appbtn:not(.add):eq(' + icon2 + ')').after(oldobj);
									}else{
										if(iconIndex2 == -1){
											$('#dock-bar .dock-applist').append(oldobj);
										}
									}
									if($('#dock-bar .dock-applist li').length > 7){
										$('#desk-' + HROS.CONFIG.desk + ' li.add').before($('#dock-bar .dock-applist li').last());
									}
									HROS.deskTop.appresize();
									//如果文件夹预览面板为显示状态，则进行更新
									if($('#qv_' + folderId).length != 0){
										HROS.folderView.init($('#d_' + folderId));
									}
									//如果文件夹窗口为显示状态，则进行更新
									if($('#w_' + folderId).length != 0){
										HROS.window.updateFolder(folderId);
									}
								}
								if(HROS.base.checkLogin()){
									$.ajax({
										type : 'POST',
										url : ajaxUrl,
										data : 'ac=updateMyApp&movetype=folder-dock&id=' + oldobj.attr('appid') + '&to=' + (icon2 + 1) + '&desk=' + HROS.CONFIG.desk
									}).done(function(responseText){
										folderDockDone();
									});
								}else{
									folderDockDone();
								}
							}else{
								var dock_w = HROS.CONFIG.dockPos == 'left' ? 73 : 0;
								var dock_h = HROS.CONFIG.dockPos == 'top' ? 73 : 0;
								icon = HROS.grid.searchAppGrid(cx - dock_w, cy - dock_h);
								if(icon != null){
									function folderDeskDone(){
										var folderId = oldobj.parents('.folder-window').attr('appid');
										if(icon < iconIndex){
											$('#desk-' + HROS.CONFIG.desk + ' li.appbtn:not(.add):eq(' + icon + ')').before(oldobj);
										}else if(icon > iconIndex){
											$('#desk-' + HROS.CONFIG.desk + ' li.appbtn:not(.add):eq(' + icon + ')').after(oldobj);
										}else{
											if(iconIndex == -1){
												$('#desk-' + HROS.CONFIG.desk + ' li.add').before(oldobj);
											}
										}
										HROS.deskTop.appresize();
										//如果文件夹预览面板为显示状态，则进行更新
										if($('#qv_' + folderId).length != 0){
											HROS.folderView.init($('#d_' + folderId));
										}
										//如果文件夹窗口为显示状态，则进行更新
										if($('#w_' + folderId).length != 0){
											HROS.window.updateFolder(folderId);
										}
									}
									if(HROS.base.checkLogin()){
										$.ajax({
											type : 'POST',
											url : ajaxUrl,
											data : 'ac=updateMyApp&movetype=folder-desk&id=' + oldobj.attr('appid') + '&to=' + (icon + 1) + '&desk=' + HROS.CONFIG.desk
										}).done(function(responseText){
											folderDeskDone();
										});
									}else{
										folderDeskDone();
									}
								}
							}
						}
					});
				}
			});
		},
		/*
		**  加载滚动条
		*/
		getScrollbar : function(){
			setTimeout(function(){
				$('#desk .desktop-container').each(function(){
					var desk = $(this), scrollbar = desk.children('.scrollbar');
					//先清空所有附加样式
					scrollbar.hide();
					desk.scrollLeft(0).scrollTop(0);
					/*
					**  判断图标排列方式
					**  横向排列超出屏幕则出现纵向滚动条，纵向排列超出屏幕则出现横向滚动条
					*/
					if(HROS.CONFIG.appXY == 'x'){
						/*
						**  获得桌面图标定位好后的实际高度
						**  因为显示的高度是固定的，而实际的高度是根据图标个数会变化
						*/
						var deskH = parseInt(desk.children('.add').css('top')) + 108;
						/*
						**  计算滚动条高度
						**  高度公式（图标纵向排列计算滚动条宽度以此类推）：
						**  滚动条实际高度 = 桌面显示高度 / 桌面实际高度 * 滚动条总高度(桌面显示高度)
						**  如果“桌面显示高度 / 桌面实际高度 >= 1”说明图标个数未能超出桌面，则不需要出现滚动条
						*/
						if(desk.height() / deskH < 1){
							desk.children('.scrollbar-y').height(desk.height() / deskH * desk.height()).css('top',0).show();
						}
					}else{
						var deskW = parseInt(desk.children('.add').css('left')) + 106;
						if(desk.width() / deskW < 1){
							desk.children('.scrollbar-x').width(desk.width() / deskW * desk.width()).css('left',0).show();
						}
					}
				});
			},500);
		},
		/*
		**  移动滚动条
		*/
		moveScrollbar : function(){
			/*
			**  手动拖动
			*/
			$('.scrollbar').on('mousedown', function(e){
				var x, y, cx, cy, deskrealw, deskrealh, movew, moveh;
				var scrollbar = $(this), desk = scrollbar.parent('.desktop-container');
				deskrealw = parseInt(desk.children('.add').css('left')) + 106;
				deskrealh = parseInt(desk.children('.add').css('top')) + 108;
				movew = desk.width() - scrollbar.width();
				moveh = desk.height() - scrollbar.height();
				if(scrollbar.hasClass('scrollbar-x')){
					x = e.clientX - scrollbar.offset().left;
				}else{
					y = e.clientY - scrollbar.offset().top;
				}
				$(document).on('mousemove', function(e){
					if(scrollbar.hasClass('scrollbar-x')){
						if(HROS.CONFIG.dockPos == 'left'){
							cx = e.clientX - x - 73 < 0 ? 0 : e.clientX - x - 73 > movew ? movew : e.clientX - x - 73;
						}else{
							cx = e.clientX - x < 0 ? 0 : e.clientX - x > movew ? movew : e.clientX - x;
						}
						scrollbar.css('left', cx / desk.width() * deskrealw + cx);
						desk.scrollLeft(cx / desk.width() * deskrealw);
					}else{
						if(HROS.CONFIG.dockPos == 'top'){
							cy = e.clientY - y - 73 < 0 ? 0 : e.clientY - y - 73 > moveh ? moveh : e.clientY - y - 73;
						}else{
							cy = e.clientY - y < 0 ? 0 : e.clientY - y > moveh ? moveh : e.clientY - y;
						}
						scrollbar.css('top', cy / desk.height() * deskrealh + cy);
						desk.scrollTop(cy / desk.height() * deskrealh);
					}
				}).on('mouseup', function(){
					$(this).off('mousemove').off('mouseup');
				});
			});
			/*
			**  鼠标滚轮
			**  只支持纵向滚动条
			*/
			$('#desk .desktop-container').each(function(i){
				$('#desk-' + (i + 1)).on('mousewheel', function(event, delta){
					var desk = $(this), deskrealh = parseInt(desk.children('.add').css('top')) + 108, scrollupdown;
					/*
					**  delta == -1   往下
					**  delta == 1    往上
					**  chrome下鼠标滚轮每滚动一格，页面滑动距离是200px，所以下面也用这个值来模拟每次滑动的距离
					*/
					if(delta < 0){
						scrollupdown = desk.scrollTop() + 200 > deskrealh - desk.height() ? deskrealh - desk.height() : desk.scrollTop() + 200;
					}else{
						scrollupdown = desk.scrollTop() - 200 < 0 ? 0 : desk.scrollTop() - 200;
					}
					desk.stop(false, true).animate({scrollTop:scrollupdown},300);
					desk.children('.scrollbar-y').stop(false, true).animate({
						top : scrollupdown / deskrealh * desk.height() + scrollupdown
					}, 300);
				});
			});
		}
	}
})();