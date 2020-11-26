mw.loader.using('mediawiki.api').then(function() {
    if (!$.getUrlVar('diff')) return;
    var Api = new mw.Api(),
    loadedRevisions = false,
    revisions = null,
    biggestChangeSize = 0,
    i18n = {
        en: {
            browse_history: 'Browse history',
            change_size: 'Change size',
            comment: 'Comment',
            date: 'Date',
            date_format: '$<date> $<month> $<year> $<hours>:$<minutes>',
            minor: 'This is a minor edit',
            page_size: 'Page size',
            page_size_format: '$1 bytes',
            pin: 'Always expand the revision slider',
            username: 'Username'
        },
        es: {
            browse_history: 'Explorar historial',
            change_size: 'Tamaño del cambio',
            comment: 'Comentario',
            date: 'Fecha',
            date_format: '$<date> de $<month> de $<year> $<hours>:$<minutes>',
            minor: 'Esta es una edición menor',
            page_size: 'Tamaño de la página',
            page_size_format: '$1 bytes',
            pin: 'Siempre expandir el deslizador de revisiones',
            username: 'Nombre de usuario'
        }
    };
    i18n.msg = function(msg, obj) {
        var lang = i18n[mw.config.get('wgUserLanguage')] || i18n[mw.config.get('wgContentLanguage')] || i18n.en;
        return lang[msg] ? replaceMagicWords(lang[msg], obj || {}) : 'N/A';
    };
    /* Gets all the revisions for a page
     * <title> The full title of the page with namespace
     * <callback> Function to be called with all the revisions
     */
    function getAllRevisions(title, callback, merge) {
        var rvcontinue;
        if (merge) {
            rvcontinue = merge.pop();
        }
        Api.get({
            action: 'query',
            prop: 'revisions',
            titles: title,
            rvlimit: 500,
            rvprop: 'ids|flags|timestamp|user|size|parsedcomment',
            rvstartid: rvcontinue
        }).done(function(data) {
            var pages = data.query.pages,
            p = pages[Object.keys(pages)[0]];
            if (merge) {
                p.revisions = merge.concat(p.revisions);
            }
            if (data['query-continue']) {
                p.revisions.push(data['query-continue'].revisions.rvstartid);
                getAllRevisions(title, callback, p.revisions);
                return;
            }
            revisions = p.revisions;
            callback(data);
        });
    }
    /* Replaces key words in a string defined by obj in the format "$<key>" or "$key"
     * <str> String to replace
     * <obj> Object with key-value pairs of the search term, and the value to replace with respectively.
     */
    function replaceMagicWords(str, obj) {
        if (typeof obj == 'string') {
            obj = ['', obj];
        }
        $.each(obj, function(key, value) {
            str = str.replace(new RegExp('\\$<?' + key + '>?', 'gi'), value);
        });
        return str;
    }
    function calcBiggestChangeSize() {
        var i = revisions.length,
        max = 0;
        while (i--) {
            max = Math.max(max, Math.abs(revisions[i].size, (revisions[i - 1] ? revisions[i - 1].size : revisions[revisions.length - 1].size)));
        }
        return max;
    }
    function calcRelativeHeight(diff_size) {
        if (diff_size == 0) {
            return 0;
        }
        return Math.ceil(
            61 * Math.log( Math.abs(diff_size) ) / biggestChangeSize
        ) + 5;
    }
    function calcRevisionsWidth(times) {
        var elems = document.getElementsByClassName('revslider-revision-wrapper');
        return elems[0].offsetWidth * (times || elems.length);
    }
    function pad(n) {
        return ('00' + n).slice(-2);
    }
    function calcRevisionsInContainer() {
        return $('.revslider-revisions-container').width() / $('.revslider-revision-wrapper').width();
    }
    function getRevisionIds() {
        return $('a[data-action^="revision-link"]').map(function(i, el) {
            return el.getAttribute('href').match(/\d+$/)[0];
        }).sort();
    }
    function createRevisionWrapper(rev, idx) {
        var prev_rev = revisions[idx + 1],
        size_diff = (prev_rev ? prev_rev.size : 0 ) - rev.size,
        size_diff_pos = size_diff < 0,
        rel_height = calcRelativeHeight(size_diff),
        wrapper = document.createElement('div'),
        rev_el = document.createElement('div')
        box_el = document.createElement('div');
        wrapper.className = 'revslider-revision-wrapper';
        rev_el.className  = 'revslider-revision revslider-revision-' + (size_diff_pos ? 'up' : 'down'); // Yes, this will show down for neutral edits. Shut up, it works.
        box_el.className  = 'revslider-revision-border-box';
        rev_el.style.height = rel_height + 'px';
        rev_el.style.top = (size_diff_pos ? '-' + rel_height : 0) + 'px';
        rev_el.setAttribute('data-revid', rev.revid);
        rev_el.setAttribute('data-size', rev.size);
        rev_el.setAttribute('data-diff', -size_diff);
        rev_el.setAttribute('data-comment', rev.parsedcomment);
        rev_el.setAttribute('data-ts', rev.timestamp);
        rev_el.setAttribute('data-user', rev.user);
        rev_el.setAttribute('data-pos', revisions.length - idx);
        rev.minor == '' && rev_el.setAttribute('data-minor', 'minor');
        rev_el.appendChild(box_el);
        wrapper.appendChild(rev_el);
        wrapper.onmouseenter = showTooltip;
        wrapper.onmouseleave = $.debounce(300, hideTooltip);
        return wrapper;
    }
    function showTooltip(e) {
        $('.revslider-revision-wrapper.hovered').removeClass('hovered');
        $('.revslider-tooltip').remove();
        var $el = $(e.target).closest('.revslider-revision-wrapper'),
        $target = $el.children(),
        offset = $el.offset(),
        window_width = window.innerWidth,
        $tooltip = $('<div>', {
            class: 'revslider-tooltip',
            'data-id': $target.attr('data-revid'),
            style: 'top: ' + (offset.top + $el.height() - 6) + 'px; left: ' + Math.max(20, Math.min(offset.left - 155, window_width - 354)) + 'px',
            append: [
                $('<div>', {
                    class: 'revslider-popup',
                    append: $('<div>', {
                        class: 'revslider-popup-body'
                    })
                }),
                $('<div>', {
                    class: 'revslider-anchor',
                    style: 'left: ' + (Math.max(Math.min(160, Math.min(offset.left - 155, window_width - 354) + 140), offset.left - window_width + 360) + 2) + 'px'
                })
            ]
        }).mouseenter(function() {
            $(this).removeAttr('data-id');
        }).mouseleave(function() {
            $(this).remove();
            $el.removeClass('hovered');
        }).appendTo('body');
        $el.addClass('hovered');
        var d = new Date($target.attr('data-ts')),
        diff = $target.attr('data-diff'),
        diffTag = '<span class="' + (diff == 0 ? 'edit-neutral' : (diff > 0 ? 'edit-positive' : 'edit-negative')) + '">' + (diff > 0 ? '+' : '') + diff + '</span>';
        $('.revslider-popup-body')
            .append(
                '<p><strong>' + i18n.msg('date') + ': </strong>' + i18n.msg('date_format', {
                    date: d.getDate(),
                    month: wgMonthNames[d.getMonth() + 1],
                    year: d.getFullYear(),
                    hours: pad(d.getHours()),
                    minutes: pad(d.getMinutes())
                }) + '</p>')
            .append('<p><strong>' + i18n.msg('username') + ': </strong><a href="/wiki/User:' + encodeURIComponent($target.attr('data-user')) + '">' + $target.attr('data-user') + '</a></p>')
            .append($target.attr('data-comment') ? '<p class="comment"><strong>' + i18n.msg('comment') + ': </strong>' + $target.attr('data-comment') + '</p>' : null)
            .append('<p><strong>' + i18n.msg('page_size') + ': </strong>' + i18n.msg('page_size_format', $target.attr('data-size')) + '</p>')
            .append('<p><strong>' + i18n.msg('change_size') + ': </strong>' + i18n.msg('page_size_format', diffTag) + '</p>')
            .append($target.attr('data-minor') ? '<p class="minor">' + i18n.msg('minor') + '</p>' : null);
    }
    function hideTooltip(e) {
        var $el = $(e.target).closest('.revslider-revision-wrapper'),
        $target = $el.children(),
        removed = $('.revslider-tooltip[data-id="' + $target.attr('data-revid') + '"]').remove();
        if (removed.length) {
            $el.removeClass('hovered');
        }
    }
    function getUrlVars() {
        $._urlVars = null;
        return $.getUrlVars();
    }
    function getStateUrl(diff, oldid) {
        var url = wgServer + location.pathname + '?diff=' + diff + '&oldid=' + oldid;
        $.each(getUrlVars(), function(key, val) {
            if (!{diff:1, oldid:1}[key]) {
                url += '&' + key + '=' + val;
            }
        });
        return url;
    }
    function updatePointerLines() {
        
    }
    var $rev_toggle = $('<div>', {
        class: 'revslider-toggle',
        append: [
            $('<span>', {
                class: 'toggle-label',
                text: i18n.msg('browse_history')
            }),
            $('<span>', {
                class: 'icon-pin' + (localStorage.getItem('revslider-pin') || ''),
                title: i18n.msg('pin'),
                click: function() {
                    if ($(this).hasClass('icon-pinned')) {
                        localStorage.removeItem('revslider-pin');
                    } else {
                        localStorage.setItem('revslider-pin', ' icon-pinned');
                    }
                    $(this).toggleClass('icon-pinned');
                }
            }),
            $('<span>', {
                class: 'toggle-icon icon-expand'
            })
        ]
    }).click(function(e) {
        if ($(e.target).closest('.icon-pin').length) return;
        $rev_slider
            .toggleClass('revslider-container-collapsed')
            .toggleClass('revslider-container-expanded');
        $('.toggle-icon')
            .toggleClass('icon-expand')
            .toggleClass('icon-collapse');
            if (!loadedRevisions) {
                loadedRevisions = true;
                console.log('lol, not implemented yet');
                getAllRevisions(wgPageName, function(data) {
                    console.log(revisions);
                    var i = revisions.length,
                    i_2 = i,
                    $rev_container = $rev_slides.find('.revslider-revisions')[0];
                    biggestChangeSize = Math.log(calcBiggestChangeSize());
                    while (i--) {
                        // This part uses raw JS due to the potentially thousands of revisions it will have to run
                        $rev_container.appendChild(createRevisionWrapper(revisions[i], i));
                    }
                    $('.revslider-placeholder').replaceWith($rev_slides);
                    var width = $('.revslider-revisions-container').width(function(i, wd) {
                        return Math.min(calcRevisionsWidth(), wd - wd % $('.revslider-revision-wrapper').width());
                    }).width();
                    $('.revslider-pointer-container').width(width + 15);
                    $rev_container = $($rev_container);
                    var half = Math.ceil(calcRevisionsInContainer() / 2),
                    revIds = getRevisionIds();
                    var $rev_el = $('.revslider-revision[data-revid="' + revIds[1] + '"]'),
                    $prev_rev_el = $('.revslider-revision[data-revid="' + revIds[0] + '"]');
                    $rev_el.parent().addClass('revslider-revision-new');
                    $prev_rev_el.parent().addClass('revslider-revision-old')
                    if ($rev_el.attr('data-pos') > revisions.length - calcRevisionsInContainer() / 2) {
                        var left = Math.max(0, calcRevisionsWidth() - $rev_container.width());
                        $rev_container.css('left', '-' + Math.max(0, calcRevisionsWidth() - $rev_container.width()) + 'px');
                        $('.revslider-arrow-forwards').addClass('revslider-arrow-disabled');
                        if (left == 0) {
                            $('.revslider-arrow-backwards').addClass('revslider-arrow-disabled');
                        }
                    } else {
                        var left = Math.max(0, $rev_el.attr('data-pos') * $rev_el.width() - $rev_container.width());
                        $rev_container.css('left', '-' + Math.max(0, $rev_el.attr('data-pos') * $rev_el.width() - $rev_container.width()) + 'px');
                        if (left == 0) {
                            $('.revslider-arrow-backwards').addClass('revslider-arrow-disabled');
                        }
                    }
                    $(window).resize(function() {
                        var width = $('.revslider-revisions-container').css('width', '').width(function(i, wd) {
                            return Math.min(calcRevisionsWidth(), wd - wd % $('.revslider-revision-wrapper').width());
                        }).width();
                        $('.revslider-pointer-container').width(width + 15);
                        var $revs = $('.revslider-revisions'),
                        left = $revs.position().left - $revs.width();
                        left = left < -(calcRevisionsWidth() - $revs.width()) ? -(calcRevisionsWidth() - $revs.width()) : left;
                        if (Math.ceil($revs.position().left) < left) {
                            $('.revslider-arrow-forwards').click();
                        } else if (Math.ceil($revs.position().left) > left) {
                            $('.revslider-arrow-forwards').removeClass('revslider-arrow-disabled');
                        }
                    });
                });
            }
    }),
    $rev_slides = $('<div>', {
        class: 'revslider-revision-slider',
        append: [
            $('<span>', {
                class: 'revslider-arrow revslider-arrow-backwards',
                click: function() {
                    var $revs = $('.revslider-revisions'),
                    left = $revs.position().left + $revs.width();
                    left = left < 0 ? left : 0;
                    $revs.css('left', left + 'px');
                    if (left == 0) {
                        $(this).addClass('revslider-arrow-disabled');
                    } else {
                        $(this).removeClass('revslider-arrow-disabled');
                    }
                    if (left == -(calcRevisionsWidth() - $revs.width())) {
                        $('.revslider-arrow-forwards').addClass('revslider-arrow-disabled');
                    } else {
                        $('.revslider-arrow-forwards').removeClass('revslider-arrow-disabled');
                    }
                }
            }),
            $('<div>', {
                class: 'revslider-revisions-container',
                append: $('<div>', {
                    class: 'revslider-revisions'
                })
            }),
            $('<span>', {
                class: 'revslider-arrow revslider-arrow-forwards',
                click: function() {
                    var $revs = $('.revslider-revisions'),
                    left = $revs.position().left - $revs.width();
                    left = left < -(calcRevisionsWidth() - $revs.width()) ? -(calcRevisionsWidth() - $revs.width()) : left;
                    $revs.css('left', left + 'px');
                    if (left == -(calcRevisionsWidth() - $revs.width())) {
                        $(this).addClass('revslider-arrow-disabled');
                    } else {
                        $(this).removeClass('revslider-arrow-disabled');
                    }
                    if (left == 0) {
                        $('.revslider-arrow-backwards').addClass('revslider-arrow-disabled');
                    } else {
                        $('.revslider-arrow-backwards').removeClass('revslider-arrow-disabled');
                    }
                }
            }),
            $('<div>', {
                style: 'clear: both'
            }),
            $('<div>', {
                class: 'revslider-pointer-container'
            })
        ]
    }),
    $rev_wrapper = $('<div>', {
        class: 'revslider-slider-wrapper',
        append: $('<div>', {
            class: 'revslider-placeholder',
            append: $('<div>', {
                class: 'progress',
                append: $('<div>', {
                    class: 'indeterminate'
                })
            })
        })
    }),
    $rev_slider = $('<div>', {
        class: 'revslider-container revslider-container-collapsed',
        append: [
            $rev_toggle,
            $rev_wrapper
        ]
    }).prependTo('#mw-content-text');
    if (localStorage.getItem('revslider-pin')) {
        $('.revslider-toggle').click();
    }
});