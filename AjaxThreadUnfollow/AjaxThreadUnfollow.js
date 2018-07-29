/*
 * Ajax Unfollow
 * Allows to quickly unfollow threads directly from your notifications
 * Personal use only
 * @author Dorumin ([[w:c:dev:AjaxThreadUnfollow]])
 */
 
(function() {
    var i18n = {
        // English
        en: {
          title: 'Shift + Click to mark as read\nCtrl + Shift + Click to quickly unfollow',
          read: 'The thread was marked as read.',
          unfollowed: 'The thread has been unwatched.'
        },
        // Беларуская
        be: {
          title: 'Націсніце  Shift + ЛКМ, каб пазначыць як прачытанае\nНажмите Ctrl + Shift + ЛКМ, каб не сачыць за тэмай',
          read: 'Тэма была адзначана як прачытаная',
          unfollowed: 'Тэма была прыбрана са спіса асочваных.'
        },
        // Español
        es: {
          title: 'Shift + Click para marcar como leído\nCtrl + Shift + Click para dejar de seguir',
          read: 'El hilo ha sido marcado como leído.',
          unfollowed: 'Has dejado de seguir al hilo.'
        },
        // Русский
        ru: {
          title: 'Нажмите  Shift + ЛКМ, чтобы пометить как прочитанное\nНажмите Ctrl + Shift + ЛКМ, чтобы не следить за темой',
          read: 'Тема была отмечена как прочитанная',
          unfollowed: 'Тема была убрана из списка отслеживаемых.'
        },
        // Українська
        uk: {
          title: 'Натисніть Shift + ЛКМ, щоб позначити як прочитане\nНатисніть Ctrl + Shift + ЛКМ, щоб не стежити за темою',
          read: 'Тему було відзначено як прочитану',
          unfollowed: 'Тему було прибрано зі списку відстежуваних.'
        },
        // Chinese
        zh: {
          title: '按下 Shift + Click 标记为已读\n按下 Ctrl + Shift + Click 一键取消追踪',
          read: '此帖子已标记为已读。',
          unfollowed: '此帖子已设为取消追踪。'
        },
        // Chinese (Taiwan)
        'zh-tw': {
          title: '按下 Shift + Click 標記為已讀\n按下 Ctrl + Shift + Click 一鍵取消追蹤',
          read: '此話題已標記為已讀。',
          unfollowed: '此話題已設為取消追蹤。'
        },
        // Polish
        pl: {
          title: 'Shift + Klik aby oznaczyć jako przeczytany\nCtrl + Shift + Klik aby szybko przestać obserwować',
          read: 'Wątek został oznaczony jako przeczytany.',
          unfollowed: 'Wątek przestał być obserwowany.'
        }
    },
    overriden = {
        read: [],
        unfollowed: []
    };
 
    i18n = i18n[wgUserLanguage] || i18n.en;
 
    function unfollow(page, wiki) {
        return $.ajax({
            type: 'POST',
            dataType: 'text',
            url: 'https://' + wiki + '.wikia.com/api.php',
            method: 'POST',
            data: {
                action: 'watch',
                unwatch: 1,
                title: page,
                token: mw.user.tokens.get('watchToken')
            },
            xhrFields: {
                withCredentials: true
            },
            crossdomain: true
        });
    }
 
    function mark_as_read(url) {
        return $.Deferred(function(def) {
            $.get(url).done(function() {
                def.resolve();
            }).fail(function() { // iframe magic
                var iframe = document.createElement('iframe');
                iframe.src = url;
                iframe.style.display = 'none';
                iframe.onload = function() {
                    def.resolve();
                    document.body.removeChild(iframe);
                };
                document.body.appendChild(iframe);
            });
        });
    }
 
    function wiki_page_from_url(url) {
        var match = url.match(/https?:\/\/(.+?)\.wikia\.com\/(?:wiki\/)?(.+)/);
        if (!match) return null;
        return [match[1], decodeURIComponent(match[2])];
    }
 
    $('#notifications').on('mouseover', '.notification.unread', function() {
        this.title = i18n.title;
    }).on('click', '.notification.unread', function(e) {
        var $this = $(this),
        url = $this.children().attr('href'),
        match = wiki_page_from_url(url);
        if (e.shiftKey && e.ctrlKey) {
            e.preventDefault();
 
            unfollow(match[0], match[1]).always(function() {
                mark_as_read(url).done(function() {
                    overriden.unfollowed.push(url);
                    $this.replaceWith(
                        $('<li>', {
                            'class': 'notification read',
                            append: $('<div>', {
                                class: 'notfication-message',
                                css: {
                                    textAlign: 'center',
                                },
                                text: i18n.unfollowed
                            })
                        })
                    );
                });
            });
        } else if (e.shiftKey) {
 
            e.preventDefault();
 
            mark_as_read(url).done(function() {
                overriden.read.push(url);
                $this.replaceWith(
                    $('<li>', {
                        'class': 'notification read',
                        append: $('<div>', {
                            class: 'notfication-message',
                            css: {
                                textAlign: 'center',
                            },
                            text: i18n.read
                        })
                    })
                );
            });
        }
    });
 
    if (!window.MutationObserver) return;
 
    var notifications = document.getElementById('notifications'),
    observer = new MutationObserver($.throttle(100, function(mutations) {
        overriden.read.forEach(function(url) {
            var a = document.querySelector('#notificationsContainer a[href="' + url + '"]');
            if (!a) return;
 
            $(a.parentElement).replaceWith(
                    $('<li>', {
                        'class': 'notification read',
                        append: $('<div>', {
                            class: 'notfication-message',
                            css: {
                                textAlign: 'center',
                            },
                            text: i18n.read
                        })
                    })
                );
        });
        overriden.unfollowed.forEach(function(url) {
            var a = document.querySelector('#notificationsContainer a[href="' + url + '"]');
            if (!a) return;
 
            $(a.parentElement).replaceWith(
                $('<li>', {
                    'class': 'notification read',
                    append: $('<div>', {
                        class: 'notfication-message',
                        css: {
                            textAlign: 'center',
                        },
                        text: i18n.unfollowed
                    })
                })
            );
        });
    }));
 
    if (!notifications) return;
 
    observer.observe(notifications,  {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
    });
})();