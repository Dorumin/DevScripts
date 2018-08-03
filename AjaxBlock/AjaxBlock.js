/*
 * AjaxBlock ([[w:c:dev:AjaxBlock]])
 *
 * @author: Dorumin
 * @scope: Personal use
 * @description: Allows user blocking without leaving the current page.
 * @update 04/05/16: Now detects block and unblock links that were added after window onload.
 * @update 22/05/16: Now supports unblocking IDs + a few minor changes.
 * @update 03/06/16: Now supports the incredibly rare and useless Special:Block?wpTarget=<user> links,
 *                   This script will not run if it was initialized already, or if you right click the link,
 *                   You now have retry, unblock, and re-block links on banner notifications,
 *                   Fixed bug while blocking IDs.
 * @update 01/09/17: Adding i18n, option group support, and some code clean-up.
 */
 
$.when(
    mw.loader.using('mediawiki.api'),
    $.Deferred(function(def) {
        if (window.dev && dev.i18n) {
            def.resolve(dev.i18n);
            return;
        }
        importArticle({
            type: 'script',
            article: 'u:dev:MediaWiki:I18n-js/code.js'
        });
        mw.hook('dev.i18n').add(function(i18n) {
            def.resolve(i18n);
        });
    })
).then(function(x, lib) {
 
    // Libraries, not including jQuery because it's jQuery
    if (!window._) {
        console.log('Wikia stopped supporting underscorejs? Noooo');
        return;
    }
 
    // Double-runs
    if (window.AjaxBlockInit) return;
    window.AjaxBlockInit = true;
 
    // Running this as a normie? Ha
    var rights = /^(bureaucrat|sysop|vstf|staff|helper|global-discussions-moderator)$/m;
    if (!rights.test(wgUserGroups.join('\n'))) return;
 
    // Import styles
    importArticle({
        type: 'style',
        article: 'u:dev:MediaWiki:AjaxBlock/code.css'
    });
 
    // Declare constants
    var Api = new mw.Api(),
    config = mw.config.get('AjaxBlock') || {}, // Suck it, AjaxBlock is now an official wg variable (not really)
    special_ns = Object.keys(wgNamespaceIds).filter(function(key) {
        return wgNamespaceIds[key] == -1;
    }),
    promises = [
        Api.get({ // For interlanguage block links
            action: 'query',
            meta: 'siteinfo',
            siprop: 'specialpagealiases'
        }),
        Api.get({ // Get default expiry times and block reasons
            action: 'query',
            meta: 'allmessages',
            ammessages: 'Ipboptions|Ipbreason-dropdown'
        }),
        lib.loadMessages('AjaxBlock') // i18n, yeah!
    ];
    config.check = config.check || {};
 
    // Declare methods
    function parse_default_reasons(wikitext) {
        wikitext = wikitext.replace(/\n\s*\n/g, '\n').trim(); // Remove the empty lines
        var split = wikitext.split('\n'),
        reasons = {},
        section = null;
        split.forEach(function(line) {
            if (line.charAt(0) != '*') {
                if (section && section.label && Object.keys(section).length - 1) {
                    reasons[section.label] = section;
                    delete reasons[section.label].label;
                    section = {label: ''};
                }
                reasons[line] = line;
            } else if (line.charAt(1) == '*') {
                if (section && section.label) {
                    if (line.slice(2) == 'label') return;
                    section[line.slice(2)] = line.slice(2);
                } else { // A ** list element without a * parent... what the hell mate
                    reasons[line.slice(2)] = line.slice(2);
                }
            } else if (line.charAt(0) == '*') {
                if (section && section.label && Object.keys(section).length - 1) {
                    reasons[section.label] = section;
                    delete reasons[section.label].label;
                }
                section = {
                    label: line.slice(1)
                };
            }
        });
        if (section && section.label && Object.keys(section).length - 1) {
            reasons[section.label] = section;
            delete reasons[section.label].label;
        }
        return reasons;
    }
 
    function parse_default_expiry_times(wikitext) {
        var split = wikitext.split(','),
        obj = {};
        split.forEach(function(item) {
            var s = item.split(':');
            obj[s[1]] = s[0];
        });
        return obj;
    }
 
    function build_select(obj, id, i18n) {
        var $sel = $('<select>').attr('id', id);
        $sel.append(
            $('<option>', {
                value: 'other',
                text: i18n.msg('other').escape()
            })
        );
        for (var i in obj) {
            var item = obj[i];
            if (typeof item == 'string') {
                $sel.append(
                    $('<option>')
                        .attr('value', i)
                        .text(item)
                );
            } else {
                var $group = $('<optgroup>', {
                    label: i
                });
                for (var j in item) {
                    $group.append(
                        $('<option>')
                            .attr('value', j)
                            .text(item[j])
                    );
                }
                $sel.append($group);
            }
        }
        return $sel;
    }
 
    function build_checkbox(id, label, checked) {
        var $wrapper = $('<div>'),
        $check = $('<input>').attr('type', 'checkbox').attr('id', id).prop('checked', checked),
        $label = $('<label>').attr('for', id).text(label.escape());
        $wrapper.append($check, $label);
        return $wrapper;
    }
 
    function show_modal(i18n, user, config, unblocking, expiry_times, block_reasons) {
        var $content = $('<div>').attr('id', unblocking ? 'ajaxUnblockModalContent' : 'AjaxBlockModalContent');
        if (unblocking) {
            $content.append(
                $('<div>', {
                    class: 'AjaxBlockInlineInput',
                    append: [
                        i18n.msg('reason').escape(),
                        $('<input>', {
                            id: 'AjaxUnblockReasonInput'
                        })
                    ]
                })
            );
        } else {
            $content.append(
                $('<div>', {
                    class: 'AjaxBlockExpiryWrapper',
                    append: [
                        i18n.msg('expiry').escape(),
                        build_select(expiry_times, 'AjaxBlockExpirySelect', i18n),
                        $('<input>', {
                            id: 'AjaxBlockExpiryInput'
                        })
                    ]
                }),
                $('<div>', {
                    class: 'AjaxBlockReasonWrapper',
                    append: [
                        i18n.msg('reason').escape(),
                        build_select(block_reasons, 'AjaxBlockReasonSelect', i18n),
                        $('<input>', {
                            id: 'AjaxBlockReasonInput'
                        })
                    ]
                }),
                $('<div>', {
                    class: 'AjaxBlockCheckers',
                    append: [
                        build_checkbox('AjaxBlockDisableWall', i18n.msg('label-disable-wall'), config.check.talk),
                        build_checkbox('AjaxBlockAutoBlock', i18n.msg('label-auto-block'), config.check.autoblock || config.check.autoBlock),
                        build_checkbox('AjaxBlockOverrideBlock', i18n.msg('label-override'), config.check.override)
                    ]
                })
            );
        }
 
        var options = {
            id: unblocking ? 'AjaxUnblockModal' : 'AjaxBlockModal'
        };
        if (unblocking) {
            options.buttons = [{
                id: 'AjaxUnblockButton',
                defaultButton: true,
                message: i18n.msg('unblock-button').escape(),
                handler: function() {
                    var config = {
                        action: 'unblock',
                        reason: $('#AjaxUnblockReasonInput').val() || '',
                        token: mw.user.tokens.get('editToken')
                    };
                    if (user.charAt(0) == '#') {
                        config.id = user.slice(1);
                    } else {
                        config.user = user;
                    }
                    Api.post(config).done(function(d) {
                        $('#AjaxUnblockModal').closeModal();
                        if (!d.error) {
                            new BannerNotification(i18n.msg('success-unblock', user).escape(), 'confirm', $('.banner-notifications-placeholder')).show();
                        } else {
                            new BannerNotification(i18n.msg('error-unblock', user, d.error.code).escape(), 'error', $('.banner-notifications-placeholder')).show();
                        }
                        if (wgCanonicalSpecialPageName == 'Contributions') {
                            setTimeout(function() {
                                window.location.reload(true);
                            }, 2000);
                        }
                    });
                }
            }, {
                id: 'AjaxUnblockCancel',
                message: i18n.msg('cancel-button').escape(),
                handler: function() {
                    $('#AjaxUnblockModal').closeModal();
                }
            }];
        } else {
            options.buttons = [{
                id: 'AjaxBlockButton',
                defaultButton: true,
                message: i18n.msg('block-button').escape(),
                handler: function() {
                    var $ex_sel = $('#AjaxBlockExpirySelect'),
                    $ex_input = $('#AjaxBlockExpiryInput'),
                    $r_sel = $('#AjaxBlockReasonSelect'),
                    $r_input = $('#AjaxBlockReasonInput'),
                    expiry = ($ex_sel.val() == 'other' ? $ex_input.val() : $ex_sel.val()).toLowerCase(),
                    reason = 
                        $r_sel.val() == 'other' ?
                            $r_input.val() :
                            $r_sel.val() + ($r_input.val().trim() ? ': ' + $r_input.val() : '');
                    var query = {
                        action: 'block',
                        user: user,
                        expiry: expiry || 'never', // Don't look at me like that, the API defaults to never too
                        reason: reason || '',
                        token: mw.user.tokens.get('editToken')
                    };
                    if (!$('#AjaxBlockDisableWall').prop('checked')) {
                        query.allowusertalk = true;
                    }
                    if ($('#AjaxBlockAutoBlock').prop('checked')) {
                        query.autoblock = true;
                    }
                    if ($('#AjaxBlockOverrideBlock').prop('checked')) {
                        query.reblock = true;
                    }
                    Api.post(query).done(function(d) {
                        $('#AjaxBlockModal').closeModal();
                        if (!d.error) {
                            new BannerNotification(i18n.msg('success-block', user).escape(), 'confirm', $('.banner-notifications-placeholder')).show();
                        } else {
                            new BannerNotification(i18n.msg('error-block', user, d.error.code).escape(), 'error', $('.banner-notifications-placeholder')).show();
                        }
                        if (wgCanonicalSpecialPageName == 'Contributions') {
                            setTimeout(function() {
                                window.location.reload(true);
                            }, 2000);
                        }
                    });
                }
            }, {
                id: 'AjaxBlockCancel',
                message: i18n.msg('cancel-button').escape(),
                handler: function() {
                    $('#AjaxBlockModal').closeModal();
                }
            }];
        }
        $.showCustomModal(i18n.msg(unblocking ? 'unblock-title' : 'block-title', user).escape(), $content, options);
    }
 
    // Await for the API requests to finish without actually using await
    $.when.apply(this, promises).then(function(specials, mw_messages, i18n) {
        // i18n, yeah!
        i18n.useUserLang();
 
        // Parse mediawiki pages into usable stuff
        var block_special = _.find(specials[0].query.specialpagealiases, function(val) {
            return val.realname == 'Block';
        }).aliases.map(function(alias) {
            return alias.toLowerCase();
        }),
        unblock_special = _.find(specials[0].query.specialpagealiases, function(val) { // A little bit of code repetition, but eh
            return val.realname == 'Unblock';
        }).aliases.map(function(alias) {
            return alias.toLowerCase();
        }),
        messages = mw_messages[0].query.allmessages,
        expiry_times = config.expiryTimes || parse_default_expiry_times(messages[0]['*']),
        block_reasons = config.blockReasons || parse_default_reasons(messages[1]['*']);
 
        // Bind to click events
        $(document).on('click', 'a[href]', function(e) {
            if (e.which != 1) return; // Left click only
            var $target = $(e.currentTarget),
            href = $target.attr('href').replace(/\/(?:wiki\/)?/, ''),
            is_special = special_ns.some(function(ns) { // Ever heard of Array.prototype.some? Me neither! Google it, it's been supported since IE9. Crazy, right?
                return href.slice(0, ns.length + 1).toLowerCase() == ns + ':';
            });
 
            if (!is_special) return;
 
            var title = href.replace(/^[^:]+:|[\/?].*/g, ''),
            blocking = block_special.indexOf(title.toLowerCase()) != -1,
            unblocking = unblock_special.indexOf(title.toLowerCase()) != -1;
 
            if (!blocking && !unblocking) return; // Another special page
 
            var uri = new mw.Uri('/wiki/' + href),
            match = href.match(/\/[^?]+/),
            target = uri.query.wpTarget || (match && match[0].slice(1));
 
            if (!target) return; // Just a regular Special:Block link with no target
 
            e.preventDefault(); // Block the default behavior
 
            target = decodeURIComponent(target).replace(/_/g, ' '); // Decode it
 
            show_modal(i18n, target, config, unblocking, expiry_times, block_reasons);
        });
    });
});