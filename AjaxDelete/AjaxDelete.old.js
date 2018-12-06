/**
 * AjaxDelete
 *
 * Allows to delete pages (through ?action=delete links) without leaving the current page.
 * Supports deleting revisions and restoring pages (does not support restoring individual revisions)
 * For personal use
 * @author Dorumin
 * @author KockaAdmiralac
 */
mw.loader.using(['mediawiki.api', 'mediawiki.Title']).then(function() {
    'use strict';
    var config = mw.config.get([
        'wgArticlePath',
        'wgContentLanguage',
        'wgFormattedNamespaces',
        'wgNamespaceNumber',
        'wgUserGroups'
    ]);
    if (
        window.AjaxDeleteLoaded ||
        !/sysop|content-moderator|vstf|staff|helper/.test(config.wgUserGroups.join())
    ) {
        return;
    }
    window.AjaxDeleteLoaded = true;
    if (!window.dev || !window.dev.i18n) {
        importArticle({
            type: 'script',
            article: 'u:dev:MediaWiki:I18n-js/code.js'
        });
    }
    window.AjaxDelete = $.extend({
        check: {
            watch: true,
            talk: true,
            subpages: false,
            protect: false
        },
        undelete: ['Undelete'],
        init: function(i18n) {
            this.i18n = i18n;
            // Legacy configuration support
            if (this.autoCheckWatch !== undefined) {
                this.check.watch = this.autoCheckWatch;
            }
            this.api = new mw.Api();
            this.buildReasons();
            this.fetchUndeleteAliases();
            $(document).click(this.click.bind(this));
            if ([-1, 1201, 2001].indexOf(config.wgNamespaceNumber) === -1) {
                require(['Mousetrap'], this.bindShortcut.bind(this));
            }
        },
        buildReasons: function() {
            var dr = this.config.deleteReasons,
                idr = this.config.imageDeleteReasons;
            this.reasons = ['', ''];
            if (!dr || !idr) {
                this.fetchDeleteReasons();
            }
            if (dr) {
                this.reasons[0] = this.makeSelectFromConfig(dr);
            }
            if (idr) {
                this.reasons[1] = this.makeSelectFromConfig(idr);
            }
        },
        fetchUndeleteAliases: function() {
            this.api.get({
                action: 'query',
                meta: 'siteinfo',
                siprop: 'specialpagealiases'
            }).done($.proxy(this.cbAliasFetch, this));
        },
        fetchDeleteReasons: function() {
            this.api.get({
                action: 'query',
                meta: 'allmessages',
                ammessages: 'deletereason-dropdown|filedelete-reason-dropdown',
                amlang: config.wgContentLanguage
            }).done($.proxy(this.cbFetch, this));
        },
        cbFetch: function(d) {
            if (d.error) {
                console.error(this.msg('errorfetch') + ': ' + d.error.code);
                return;
            }
            var am = d.query.allmessages;
            this.makeSelectFromWikitext(am, 0);
            this.makeSelectFromWikitext(am, 1);
        },
        cbAliasFetch: function(d) {
            var aliases = d.query.specialpagealiases;
 
            for (var i in aliases) {
                if (aliases[i].realname == 'Undelete') {
                    this.undelete = aliases[i].aliases;
                }
            }
        },
        makeReasonsHTML: function() {
            var $select = $('<select>', {
                id: 'AjaxDeleteReasonSelect'
            });
            if (!this.config.noOther) {
                $select.append(
                    $('<option>', {
                        value: 'other',
                        text: this.i18n.msg('other').plain()
                    })
                );
            }
            return $select;
        },
        makeSelectFromConfig: function(obj) {
            var $select = this.makeReasonsHTML();
            // Don't use $.each or $.map here because if the
            // user specifies a "length" parameter in the configuration
            // and some other stuff jQuery will interpret it
            // as an array and bad things can happen
            for (var key in obj) {
                // Check if the object has the property and if it's not stolen from the prototype
                // because if an user can set a length parameter, some other retard
                // can also inherit from a class, or write their own proto functions
                if (obj.hasOwnProperty(key)) {
                    $select.append(
                        $('<option>', {
                            value: key,
                            text: obj[key]
                        })
                    );
                }
            }
            return $select;
        },
        makeSelectFromWikitext: function(obj, index) {
            if (this.reasons[index]) {
                return;
            }
            var $select = this.makeReasonsHTML();
            obj[index]['*'].trim().split('\n').forEach(function(line) {
                line = line.trim(); // In case of \r or something dumb
                if (line.charAt(1) === '*') {
                    var text = line.slice(2).trim();
                    $select.append(
                        $('<option>', {
                            value: text,
                            text: text
                        })
                    );
                } else if (line.charAt(0) === '*') {
                    $select.append(
                        $('<optgroup>', {
                            label: line.slice(1).trim()
                        })
                    );
                }
            });
            this.reasons[index] = $select;
        },
        click: function(e) {
            var $target = $(e.target);
            if (
                e.ctrlKey || e.shiftKey ||
                !$target.is('a[href]') ||
                $('[data-tab-body="about"]').html() === ''
            ) {
                return;
            }
            var url;
            try {
                url = new mw.Uri($target.attr('href'));
            } catch(e) {
                return;
            }
            if (!$target.is('.ignoreAjDel') && !$('#AjaxUndeleteModal').exists()) {
                if (url.query.action === 'delete') {
                    e.preventDefault();
                    this.doDelete(url, $target);
                } else if (this.isUndelete(url)) {
                    e.preventDefault();
                    this.doUndelete(url, $target);
                }
            }
        },
        isUndelete: function(url) {
            return this.undelete.some(function(alias) {
                return url.path.indexOf(mw.util.getUrl('Special:' + alias + '/')) === 0 ||
                url.path === mw.util.getUrl('Special:' + alias) &&
                url.query.target;
            }) &&
            !this.config.noUndelete &&
            // URLs on undeletion history should not open the modal
            !url.query.timestamp;
        },
        doDelete: function(url, $target) {
            this.action = 'delete';
            var isImg = $target.is('a[href*="/wiki/File:"]'),
                isRevImg = url.query.oldimage ? url.query.oldimage : false,
                page = decodeURIComponent(url.path).replace(config.wgArticlePath.replace('$1', ''), '').replace(/_/g, ' '),
                text = isImg ?
                    isRevImg ?
                        this.i18n.msg('deleteimgrev', isRevImg.split('!')[0], page) :
                        this.i18n.msg('deleteimg', page.replace('File:', '')) :
                    this.i18n.msg('deletepage', page);
            this.page = page;
            this.rev = isRevImg;
            this.showModal([
                $('<p>', {
                    id: 'AjaxDeleteText',
                    text: text.plain()  
                }),
                $('<label>', {
                    id: 'AjaxDeleteReasonLabel',
                    'for': 'AjaxDeleteReasonSelect',
                    text: this.msg('reason') + ' '
                }),
                this.reasons[Number(isImg)],
                $('<br>'),
                $('<input>', {
                    id: 'AjaxDeleteCustomReason',
                    type: 'text'
                }).attr('size', 50),
                $('<br>'),
                $('<input>', {
                    id: 'AjaxDeleteWatch',
                    type: 'checkbox'
                }),
                $('<label>', {
                    'for': 'AjaxDeleteWatch',
                    id: 'AjaxDeleteWatchLabel',
                    text: this.msg('watch')
                })
            ]);
            $('#AjaxDeleteWatch').prop('checked', this.acw);
        },
        capAction: function() {
            return this.action.charAt(0).toUpperCase() + this.action.substring(1);
        },
        showModal: function(elements) {
            var cap = this.capAction();
            $.showCustomModal(
                this.i18n.msg('title-' + this.action, this.page).escape(),
                $('<div>').append(elements).html(),
                {
                    id: 'Ajax' + cap + 'Modal',
                    buttons: [
                        {
                            id: 'Ajax' + cap + 'Button',
                            defaultButton: true,
                            message: this.i18n.msg(this.action).escape(),
                            handler: $.proxy(this['handle' + cap], this)
                        },
                        {
                            id: 'Ajax' + cap + 'CancelButton',
                            defaultButton: true,
                            message: this.i18n.msg('cancel').escape(),
                            handler: $.proxy(this.close, this)
                        }
                    ]
                }
            );
            // User that wanted to delete something would probably
            // want these focused
            var $reason = $('#AjaxDeleteCustomReason, #AjaxUndeleteReason');
            if ($('#AjaxDeleteReasonSelect option').length < 2) {
                $reason.focus();
            } else {
                $('#AjaxDeleteReasonSelect').focus();
            }
            // When Enter is pressed, execute the deletion
            $reason.keydown(this.keydown);
        },
        keydown: function(e) {
            if (e.which === 13 || e.which === 11) {
                $('#AjaxDeleteButton, #AjaxUndeleteButton').click();
            }
        },
        handleDelete: function() {
            var customReason = $('#AjaxDeleteCustomReason').val(),
                selectedReason = $('#AjaxDeleteReasonSelect').val();
            this.apiCall(
                selectedReason === 'other' ?
                    customReason :
                    customReason ?
                        selectedReason + ': ' + customReason :
                        selectedReason,
                $('#AjaxDeleteWatch').prop('checked')
            );
            this.close();
        },
        apiCall: function(reason, watchlist) {
            var params = {
                action: this.action,
                bot: true,
                reason: reason,
                title: this.page,
                token: mw.user.tokens.get('editToken')
            };
            if (this.rev) {
                params.oldimage = this.rev;
            }
            if (watchlist) {
                params.watchlist = 'watch';
            }
            this.api.post(params).done($.proxy(this.cbDone, this)).fail($.proxy(this.cbFail, this));
        },
        cbDone: function(d) {
            if (d.error) {
                this.banner('error', d.error.code);
            } else {
                if (this.config.reload) {
                    location.reload();
                } else {
                    this.banner('confirm');
                    $.get('/wiki/Special:BlankPage');
                }
            }
        },
        cbFail: function() {
            this.banner('error', 'ajax');
        },
        banner: function(type, code) {
            var msg = this.action;
            if (this.rev) {
                msg += 'rev';
            }
            msg = this.i18n.msg(type + msg, this.page).parse() + ' ';
            if (code === 'ajax') {
                msg += $('<a>', {
                    href: this.action === 'delete' ?
                        mw.util.getUrl(this.page, {
                            action: 'delete'
                        }) :
                        mw.util.getUrl('Special:Undelete/' + this.page),
                    text: this.msg('retry')
                }).prop('outerHTML');
            } else if (code) {
                msg += ' (' + code + ')';
            }
            new BannerNotification(msg, type).show();
        },
        close: function() {
            $('#Ajax' + this.capAction() + 'Modal').closeModal();
        },
        doUndelete: function(url) {
            this.action = 'undelete';
            if (url.query.target) {
                this.page = url.query.target
                    .replace(/_/g, ' ');
            } else {
                this.page = decodeURIComponent(url.path)
                    .replace(/_/g, ' ');
                this.undelete.forEach(function(alias) {
                    this.page = this.page
                        .replace(mw.util.getUrl('Special:' + alias + '/'), '');
                }, this);
            }
            this.showModal([
                $('<p>', {
                    id: 'AjaxDeleteText',
                    html: this.i18n.msg('undeletepage', this.page).parse()
                }),
                $('<input>', {
                    id: 'AjaxUndeleteReason',
                    type: 'text'
                }).attr('size', 40)
            ]);
        },
        handleUndelete: function() {
            this.apiCall($('#AjaxUndeleteReason').val().trim());
            this.close();
        },
        bindShortcut: function(Mousetrap) {
            Mousetrap.bind('d', this.shortcut);
        },
        shortcut: function() {
            $('#ca-delete').click();
        },
        msg: function(code) {
            return this.i18n.msg(code).plain();
        }
    }, window.AjaxDelete);
    mw.hook('dev.i18n').add(function(i18no) {
        i18no.loadMessages('AjaxDelete').then(
            $.proxy(AjaxDelete.init, AjaxDelete)
        );
    });
});