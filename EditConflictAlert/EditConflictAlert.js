/* EditConflictAlert
 *
 * Tells the user when a page that is currently being edited is updated.
 *
 * @author Dorumin
 */

mw.loader.using('mediawiki.api').then(function() {
    var config = mw.config.get([
        'wgAction',
        'wgNamespaceNumber',
        'wgNamespaceIds',
        'wgPageName'
    ])
    
    if (
        ['edit', 'submit'].indexOf(config.wgAction) == -1 ||
        [1200, 1201, 2002].indexOf(config.wgNamespaceNumber) != -1 ||
        window.EditConflictAlert && EditConflictAlert.init
    ) return;

    window.EditConflictAlert = $.extend({
        // Static
        config: config,
        api: new mw.Api(),
        // State
        _preload: 0,
        notifications: null,
        old: null,
        cur: null,
        // Methods
        preload: function() {
            if (++this._preload == 3) {
                dev.i18n.loadMessages('EditConflictAlert').then(this.init.bind(this));
            }
        },
        alert: function() {
            if ($('.banner-notifications-wrapper[data-id="' + r.revid + '"]').length) return;
            this.cur.viewed = true;
            var message = i18n.msg('notification-body').escape()
                + ' (<a id="view-diff" href="#">'
                + i18n.msg('diff').escape()
                + '</a>)';
            new BannerNotification(
                message,
                'notify'
            ).show();
            $('#view-diff').click(function(e) {
                e.preventDefault();
                show_diff_modal();
            });
        },
        fetch: function(update) {
            return this.api.get({
                action: 'query',
                prop: 'revisions',
                rvprop: 'ids|user|content',
                titles: wgPageName,
                cb: Date.now()
            }).then(function(d) {
                var page = d.query.pages[Object.keys(d.query.pages)[0]];
                if (page.missing || !page.revisions || !page.revisions[0]) return;
                var rev = page.revisions[0];
                if (update) {
                    if (this[update].revid != rev.revid) {
                        this[update] = rev;
                    }
                } else {
                    this.old = rev;
                    this.cur = rev;
                }

                if (this.old.revid != this.cur.revid) {
                    this.alert();
                }
            }.bind(this));
        },
        prepareDOM: function() {
            this.notifications = document.querySelector('.banner-notifications-placeholder');
            if (!this.notifications) {
                var page = document.getElementById('WikiaPage');
                this.notifications = dev.ui({
                    type: 'div',
                    classes: ['banner-notifications-placeholder'],
                    style: {
                        position: 'absolute',
                        height: 0,
                        left: 0,
                        right: 0
                    },
                    children: [
                        {
                            type: 'div',
                            classes: ['banner-notifications-wrapper float'],
                            style: {
                                top: '56px'
                            }
                        }
                    ]
                });
                page.parentElement.insertBefore(this.notifications, page);
            }
        },
        init: function(i18n) {
            this.i18n = i18n;

            this.prepareDOM();
            this.fetch();
            setInterval(this.fetch.bind(this, 'cur'));

        }
    }, window.EditConflictAlert);

    mw.hook('dev.ui').add(EditConflictAlert.preload.bind(EditConflictAlert));
    mw.hook('dev.i18n').add(EditConflictAlert.preload.bind(EditConflictAlert));
    window.addEventListener('load', EditConflictAlert.preload.bind(EditConflictAlert));

    importArticles({
        type: 'script',
        articles: [
            'u:dev:MediaWiki:I18n-js/code.js',
            'u:dev:MediaWiki:UI-js/code.js'
        ]
    });
});


/* EditConflictAlert
 *
 * Tells the user when a page that is currently being edited is updated.
 *
 * @author Dorumin
 */
 
require(['jquery', 'mw', 'BannerNotification'], function($,mw,BannerNotification) {
    if (
        !(wgAction === 'edit' || wgAction === 'submit') ||
        {1201: 1, 1200: 1, 2002: 1}[wgNamespaceNumber] ||
        window.EditConflictAlertInit
    )  {
        return;
    }
    window.EditConflictAlertInit = true;
    mw.loader.using('mediawiki.api').then(function() {
        var Api = new mw.Api(),
        help = Object.keys(wgNamespaceIds).filter(function(id) {
            return wgNamespaceIds[id] == 12;
        })[0].replace(/\b./g, function(char) {
            return char.toUpperCase();
        }),
        cur_id,
        old_id,
        diff,
        content,
        i18n;
 
        if (!window.dev || !window.dev.i18n) { // i18n-js lib
            importArticle({
                type: 'script',
                article: 'u:dev:MediaWiki:I18n-js/code.js'
            });
        }
 
        function fetch_revs(with_content) {
            return Api.get({
                action: 'query',
                prop: 'revisions',
                rvprop: 'ids|user|content',
                titles: wgPageName,
                cb: Date.now()
            });
        }
 
        function load_diff() {
            $.get('/?diffonly=1&diff=' + cur_id + '&oldid=' + old_id, function(page) {
                var $el = $(page).find('.diff');
                diff = $('<div>').append($el.clone()).html();
                $('#ajax-indicator').replaceWith(diff);
            });
        }
 
        function add_content() {
            $('#diff-modal').closeModal();
            $('.banner-notification .close').click();
            $('#diff, #myedit').remove();
            $('[name="wpStarttime"]').val(new Date().toISOString().replace(/\D/g, '').slice(0, -3));
            var $edit_area = $('#wpTextbox1'),
            your_text = $edit_area.val(),
            $diff = $('<div>', {
                id: 'diff'
            }).append($('<h2>', {
                append: $('<span>', {
                    class: 'mw-headline',
                    id: 'The_differences_.28help.29',
                    append: [
                        i18n.msg('the-differences').escape(),
                        ' (',
                        $('<a>', {
                            target: '_blank',
                            href: '/wiki/' + help + ':Diff',
                            title: help + ':Diff',
                            text: i18n.msg('help').plain()
                        }),
                        ')'
                    ]
                })
            }), $(diff)),
            $myedit = $('<div>', {
                id: 'myedit'
            }).append($('<h2>', {
                append: $('<span>', {
                    class: 'mw-headline',
                    id: 'myedit-header',
                    text: i18n.msg('your-edit').plain()
                })
            }), $('<textarea>', {
                id: 'wpTextbox2',
                name: 'wpTextbox2',
                tabindex: 6,
                readonly: true,
                accesskey: ',',
                cols: 80,
                rows: 25,
                lang: wgContentLanguage,
                dir: document.documentElement.dir,
                val: your_text
            }));
            $edit_area.val(content);
            $('.mw-editTools').after($diff, $myedit);
        }
 
        function add_ace_content() {
            $('#diff-modal').closeModal();
            $('.banner-notification .close').click();
            $('#diff, #myedit').remove();
            $('[name="wpStarttime"]').val(new Date().toISOString().replace(/\D/g, '').slice(0, -3));
            var $edit_area = $('#wpTextbox1'),
            your_text = $edit_area.val(),
            $diff = $('<div>', {
                id: 'diff'
            }).append($('<h2>', {
                append: $('<span>', {
                    class: 'mw-headline',
                    id: 'The_differences_.28help.29',
                    append: [
                        i18n.msg('the-differences').escape(),
                        ' (',
                        $('<a>', {
                            target: '_blank',
                            href: '/wiki/' + help + ':Diff',
                            title: help + ':Diff',
                            text: i18n.msg('help').plain()
                        }),
                        ')'
                    ]
                })
            }), $(diff)),
            $myedit = $('<div>', {
                id: 'myedit'
            }).append($('<h2>', {
                append: $('<span>', {
                    class: 'mw-headline',
                    id: 'myedit-header',
                    text: i18n.msg('their-edit').plain()
                })
            }), $('<textarea>', {
                id: 'wpTextbox2',
                name: 'wpTextbox2',
                tabindex: 6,
                readonly: true,
                accesskey: ',',
                cols: 80,
                rows: 25,
                lang: wgContentLanguage,
                dir: document.documentElement.dir,
                val: content
            }));
            $('.mw-editTools').after($diff, $myedit);
        }
 
        function show_diff_modal() {
            $.showCustomModal(i18n.msg('diff-between-revs').escape(), $('<img>').attr({
                id: 'ajax-indicator',
                src: mw.config.get('stylepath') + '/common/images/ajax.gif',
                title: i18n.msg('loading').plain(),
                alt: i18n.msg('loading').plain()
            }).css({
                float: 'center',
                margin: '2em auto',
                display: 'block'
            }), {
                width: Math.min(window.innerWidth - 200, 1000),
                id: 'diff-modal',
                callback: load_diff,
                buttons: [{
                    message: i18n.msg('close').escape(),
                    handler: function() {
                        $('#diff-modal').closeModal();
                    }
                }, {
                    defaultButton: true,
                    message: i18n.msg('update').escape(),
                    handler: window.ace ? add_ace_content : add_content
                }]
            });
        }
 
        function init() {
            fetch_revs(false).done(function(data) {
                var d = data.query.pages;
                old_id = cur_id = d[Object.keys(d)[0]].revisions[0].revid;
            });
 
            setInterval(function() {
                fetch_revs(true).done(function(data) {
                    var d = data.query.pages,
                        p = d[Object.keys(d)[0]];
                    if (!p.revisions) {
                        // We are editing a nonexistent page.
                        return;
                    }
                    var r = p.revisions[0];
                    content = r['*'];
                    if (r.revid != cur_id && r.user != wgUserName) {
                        if ($('.banner-notifications-wrapper[data-id="' + r.revid + '"]').length) return;
                        if ($('#diff-modal').length) {
                            $('#diff-modal').closeModal();
                        }
                        $('.banner-notifications-wrapper').remove();
                        cur_id = r.revid;
                        var message = i18n.msg('notification-body').escape()
                            + ' (<a id="view-diff" href="#">'
                            + i18n.msg('diff').escape()
                            + '</a>)';
                        new BannerNotification(
                            message, 
                            'notify', 
                            $('.banner-notifications-placeholder')
                        ).show().$element.parent().attr('data-id', cur_id);
                        $('#view-diff').click(function(e) {
                            e.preventDefault();
                            show_diff_modal();
                        });
                    }
                });
            }, window.EditConflictAlertInterval || 
            window.queryInterval /* DEPRECATED */ ||
            5000);
        }
 
        mw.hook('dev.i18n').add(function(lib) {
            lib.loadMessages('EditConflictAlert').done(function(lang) {
                i18n = lang;
                i18n.useUserLang();
                init();
            });
        });
    });
});