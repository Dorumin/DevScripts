importArticle({
    type: 'script',
    article: 'u:dev:MediaWiki:Chat-js.js'
});

mw.loader.using('mediawiki.api').then(function() {
    mw.hook('dev.chat.render').add(function() {
        var api = new mw.Api();
        new dev.chat.Button({
            name: 'BanLog',
            attr: {
                click: show_modal,
                text: 'ChatBan Log',
            }
        });

        function show_modal() {
            $.showCustomModal('Recent Bans', 'Loadin\' and I\'m too lazy for an ajax indicator', {
                callback: after_modal,
                width: 600,
                height: 600
            });
        }

        function after_modal($modal) {
            load_logs().then(update_modal.bind(window, $modal));
        }

        function load_logs() {
            return api.get({
                list: 'logevents',
                letype: 'chatban',
                lelimit: 50
            }).then(format_log_result);
        }

        function format_log_result(data) {
            return data.query.logevents;
        }

        function update_modal($modal, logs) {
            $modal
                .find('.modalContent')
                .empty()
                .height(520)
                .append(
                    $('<ul>', {
                        append: logs.map(elem_from_log),
                        css: {
                            overflow: 'auto',
                            height: '100%'
                        }
                    })
                );
        }

        function elem_from_log(log) {
            return $('<li>', {
                html: log_text(log)
            })
        }

        function log_text(log) {
            switch (log.action) {
                case 'chatbanadd':
                    return links(log.user) + ' banned ' + links(log.title) + ' for ' + duration(log) + ': ' + parse_comment(log.comment);
                case 'chatbanchange':
                    return links(log.user) + ' changed ban settings ' + links(log.title) + ' to ' + duration(log) + ': ' + parse_comment(log.comment);
                case 'chatbanremove':
                    return links(log.user) + ' removed ban for ' + links(log.title) + ': ' + parse_comment(log.comment);
            }
            return 'undefined';
        }

        function links(user) {
            user = user.replace(/^User:/i, '');
            return [
                link('User:' + user, user),
                ' (',
                link('Special:Contribs/' + user, 'c'),
                ')'
            ].map(function(jq) {
                return typeof jq == 'string' ? jq : jq.get(0).outerHTML
            }).join('');
        }

        function link(href, text) {
            return $('<a>', {
                href: '/wiki/' + href,
                target: '_blank',
                text: text || href
            });
        }

        function parse_comment(comment) {
            return comment.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, function(_, page, text) {
                console.log(page, text, _);
                if (text === undefined) return link(page).prop('outerHTML');
                if (text === '') return link(page, page.split(':').slice(1).join(':')).prop('outerHTML');
                return link(page, text).prop('outerHTML');
            });
        }

        function duration(log) {
            if (log[2]) return log[2];
            return log[4] + ' seconds';
        }
    });
});