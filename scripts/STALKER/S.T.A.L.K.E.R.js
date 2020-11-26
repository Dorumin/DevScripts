/*
 * S.T.A.L.K.E.R.
 *
 * WikiActivity. Reloaded.
 *
 * @author Dorumin
 */

window.dev = $.extend(true, window.dev, {
    i18n: {
        overrides: {
            'S.T.A.L.K.E.R.': {
                'document-title': 'S.T.A.L.K.E.R. | $1 | Fandom',
                'header-text': 'S.T.A.L.K.E.R.',
                'settings-tooltip': 'Settings',
                'settings-header': 'Settings',
                'settings-namespaces-label': 'Namespaces',
                'settings-namespaces-most': 'Most',
                'settings-namespaces-all': 'All',
                'settings-namespaces-custom': 'Custom',
                'settings-discussions': 'Show discussions',
                'settings-quickdiff': 'Open diffs inside modal',
                'settings-desktop-notifications': 'Desktop notifications',
                'settings-logs': 'View logs',
                'added-category': 'Added category',
                'added-categories': 'Added categories',
                'edited-by': 'edited by [[User:$1|$1]] $2',
                'seconds-ago': '{{PLURAL:$1|a second ago|$1 seconds ago}}',
                'minutes-ago': '{{PLURAL:$1|a minute ago|$1 minutes ago}}',
                'hours-ago': '{{PLURAL:$1|an hour ago|$1 hours ago}}',
                'days-ago': '{{PLURAL:$1|a day ago|$1 days ago}}',
                'months-ago': '{{PLURAL:$1|a month ago|$1 months ago}}',
                'long-time-ago': 'a very long time ago',
                'diff-title': 'View changes',
                'type-new': 'New page',
                'type-edit': 'Edit',
                'type-log': 'Log event',
                'type-categories-add': 'Adding categories',
                'type-categories-remove': 'Removing categories',
                'type-categories-update': 'Updating categories',
                'type-discussions-post': 'Discussions post',
                'type-discussions-reply': 'Discussions reply',
                'type-discussions-edit': 'Discussions edit',
                'type-discussions-delete': 'Discussions deletion',
                'type-wall-post': 'Message Wall post',
                'type-wall-reply': 'Message Wall reply',
                'type-wall-delete': 'Message Wall deletion',
                'diff-modal-title': 'Diff',
                'diff-modal-close': 'Close',
                'diff-modal-undo': 'Undo',
                'diff-modal-rollback': 'Rollback',
                'diff-modal-delete': 'Delete'
            }
        }
    }
});

(function() {
    // Double load protection, unless debug mode is on
    if (window.STALKER && window.STALKER.loaded) {
        if (window.STALKER.DEBUG) {
            window.STALKER.cleanup();
            window.STALKER = undefined;
        } else {
            return;
        }
    }

    window.STALKER = $.extend({
        loaded: true,

        // Debug flag, whether invariants should be checked at runtime
        DEBUG: true,

        // Config options, restored automatically without js config
        limit: 50,
        discussions: true,
        namespaces: [0, 1, 2],

        // Globals
        wg: mw.config.get([
            // For group checking
            // TODO: Figure out whether this is really needed
            'wgUserGroups',
            // For the namespace filter
            'wgFormattedNamespaces',
            // For the discussions api requests
            'wgCityId',
            // For checking if the current page is Special:WikiActivity
            'wgTitle',
            // ... for checking if the current page is Special:WikiActivity
            'wgNamespaceNumber',
            // For getting the current content language adding categories summary
            'wgContentLanguage'
        ]),
        isUCP: parseFloat(mw.config.get('wgVersion')) > 1.19,
        // Hacky thing to know which edits are adding categories
        // Taken from https://github.com/Wikia/app/blob/dev/extensions/wikia/CategorySelect/CategorySelect.i18n.php
        addingCategoriesSummary: {
            'en': 'Adding categories',
            'ar': 'إضافة التصانيف',
            'az': 'Gizli kateqoriyalar',
            'bar': 'Kategorie dazuadoah',
            'bg': 'Добавяне на категории',
            'br': 'Ouzhpennañ ur rummad',
            'ca': 'Afegint categories',
            'cs': 'Přidávání kategorií',
            'de': 'Kategorien hinzufügen',
            'es': 'Añadiendo categorías',
            'fa': 'افزودن رده',
            'fi': 'Luokkien lisääminen',
            'fo': 'Legg bólkar afturat',
            'fr': 'Ajout de catégories',
            'gl': 'Inserción de categorías',
            'he': 'הוספת קטגוריות',
            'hu': 'Kategóriák hozzáadása',
            'ia': 'Addition de categorias…',
            'id': 'Menambahkan kategori',
            'it': 'Aggiunte categorie',
            'ja': 'カテゴリを追加',
            'kn': 'ವರ್ಗಗಳನ್ನು ಸೇರಿಸಲಾಗುತ್ತಿದೆ',
            'ko': '분류 추가',
            'lb': 'Kategorien derbäisetzen',
            'lrc': 'اضاف بیئن دسه یا',
            'mk': 'Додавање на категории',
            'ms': 'Menambahkan kategori',
            'nb': 'Legger til kategorier',
            'nl': 'Bezig met het toevoegen van categorieën',
            'oc': 'Apondon de categorias',
            'pl': 'Dodawanie kategorii',
            'pms': 'Gionté categorìe',
            'ps': 'وېشنيزې ورگډول',
            'pt': 'Adicionando categorias',
            'roa-tara': 'Categorije aggiunde',
            'ru': 'Добавление категорий',
            'sa': 'वर्गान् योजयति',
            'sr-ec': 'Додавање категорија',
            'sv': 'Lägger till kategorier',
            'te': 'వర్గాలను చేరుస్తున్నాం',
            'tl': 'Idinaragdag ang mga kategorya',
            'tt-cyrl': 'Төркемнәр өстәү',
            'uk': 'Додавання категорій',
            'vi': 'Thêm thể loại',
            'zh-hans': '添加分类',
            'zh-hant': '增加分類'
        },

        // All of these will be limited by this.limit
        cachedDiscussionsEvents: [],
        cachedRecentChangeEvents: [],
        cachedCombinedEvents: [],
        // For potential diffing
        cachedDiscussionsPostMap: {},
        // For discussions posts, diffs?
        cachedAvatarMap: {},
        // To get promises for the difference of categories between revisions, $oldid-$newid
        categoriesAddedPromiseMap: {},

        // Resource management
        loading: [
            'css',
            'api',
            'banners',
            'i18n',
            'i18n-js',
            'modal-js',
            'ui-js',
            'settings',
            'initial-d',
            'initial-rc',
            'initial-both'
        ],
        onload: function(key, arg) {
            // Untick dependency
            var index = this.loading.indexOf(key);
            if (index === -1) throw new Error('Unregistered dependency loaded: ' + key);

            this.loading.splice(index, 1);

            switch (key) {
                case 'i18n-js':
                    var lib = arg;
                    lib.loadMessages('S.T.A.L.K.E.R.').then(this.onload.bind(this, 'i18n'));
                    break;
                case 'i18n':
                    var i18n = arg;
                    this.i18n = i18n;
                    break;
                case 'api':
                    this.api = new mw.Api();
                    this.loadInitialRecentChanges();
                    break;
                case 'banners':
                    var BannerNotification = arg;
                    this.BannerNotification = BannerNotification;
                    break;
            }

            // Custom stuff
            if (this.areLoaded(['initial-d', 'initial-rc']) && !this.isLoaded('initial-both')) {
                this.computeCombinedCachedEvents();
                this.onload('initial-both');
            }

            if (this.loading.length !== 0) return;

            this.init();
        },
        isLoaded: function(dep) {
            return !this.loading.includes(dep);
        },
        areLoaded: function(deps) {
            return deps.every(this.isLoaded.bind(this));
        },
        shouldRun: function() {
            if (this.wg.wgNamespaceNumber !== -1) return false;

            if (this.wg.wgTitle !== 'WikiActivity') return false;

            return true;
        },
        hasGroups: function(groups) {
            var len = groups.length;
            while (len--) {
                if (this.wg.wgUserGroups.indexOf(groups[len]) !== -1) return true;
            }

            return false;
        },
        preload: function() {
            // Styles
            var imported = importArticle({
                type: 'style',
                article: 'u:dev:MediaWiki:S.T.A.L.K.E.R.css'
            });

            imported.then(this.onload.bind(this, 'css'));

            // Dev libs
            importArticles({
                type: 'script',
                articles: [
                    'u:dev:MediaWiki:BannerNotification.js',
                    'u:dev:MediaWiki:Modal.js',
                    'u:dev:MediaWiki:I18n-js/code.js',
                    'u:dev:MediaWiki:UI-js/code.js'
                ]
            });

            // Hydrate settings
            this.loadSettings();

            // Preload discussions activity
            this.loadInitialDiscussions();

            // Hire some hookers
            mw.hook('dev.banners').add(this.onload.bind(this, 'banners-js'));
            mw.hook('dev.modal').add(this.onload.bind(this, 'modal-js'));
            mw.hook('dev.i18n').add(this.onload.bind(this, 'i18n-js'));
            mw.hook('dev.ui').add(this.onload.bind(this, 'ui-js'));

            // Loader modules
            mw.loader.using('mediawiki.api').then(this.onload.bind(this, 'api'));
        },
        // Currently sync, could easily be made async
        loadSettings: function() {
            var item = localStorage.getItem('STALKER-settings');
            if (item !== null) {
                var parsed = JSON.parse(item);

                this.limit = parsed.limit;
                this.namespaces = parsed.namespaces;
            }

            this.onload('settings');
        },
        // Initial http requests
        loadInitialDiscussions: function() {
            return this.loadDiscussions().then(function(response) {
                this.onDiscussionsLoaded(response._embedded);

                // Deja vu
                // I've just been in this place before
                // Higher on the street
                // And I know it's my time to go
                // Calling you and the search is mystery
                // Standing on my feet
                // It's so hard when I try to be me uoooh!
                // Deja vu
                // I've just been in this time before
                // Higher on the street
                // And I know it's my place to go
                // Calling you and the search is mystery
                // Standing on my feet
                // It's so hard when I try to be me, yeah!
                this.onload('initial-d');
            }.bind(this));
        },
        loadInitialRecentChanges: function() {
            this.loadRecentChanges().then(function(response) {
                this.onRecentChangesLoaded(response.query.recentchanges);

                this.onload('initial-rc');
            }.bind(this));
        },
        loadRecentChanges: function() {
            return this.api.get({
                action: 'query',
                list: 'recentchanges',
                // TODO: Potentially request 'max' if there's enough filters that the limit might be cut short
                rclimit: this.limit,
                rctype: 'edit|new|log|categorize',
                rcprop: 'user|comment|parsedcomment|flags|timestamp|ids',
                rcnamespace: this.namespaces.join('|')
            });
        },
        loadDiscussions: function() {
            return $.ajax({
                url: 'https://services.fandom.com/discussion/' + this.wg.wgCityId + '/posts',
                data: {
                    limit: this.limit,
                    containerType: 'FORUM',
                    viewableOnly: false
                }
            });
        },
        onRecentChangesLoaded: function(changes) {
            var lastEvent = this.cachedRecentChangeEvents[0];

            for (var i in changes) {
                var entry = changes[i];
                var event = this.recentChangeToEvent(entry);

                if (lastEvent) {
                    if (lastEvent.time < event.time) break;
                } else {
                    this.cachedRecentChangeEvents.push(event);
                    this.onRecentChangeEvent(event);
                    continue;
                }

                this.cachedRecentChangeEvents.unshift(event);
                this.onRecentChangeEvent(event);
            }

            if (this.cachedRecentChangeEvents.length > this.limit) {
                this.cachedRecentChangeEvents = this.cachedRecentChangeEvents.slice(0, this.limit);
            }
        },
        onRecentChangeEvent: function(event) {
            if (!this.addingCategoriesSummary.hasOwnProperty(this.wg.wgContentLanguage)) return;

            var summary = this.addingCategoriesSummary[this.wg.wgContentLanguage];
            if (event.payload.comment !== summary) return;

            event.type = '@rc-add-categories';

            var oldid = event.payload.old_revid.toString();
            var curid = event.payload.revid.toString();
            var key = oldid + '-' + curid;

            if (this.categoriesAddedPromiseMap.hasOwnProperty(key)) {
                if (this.DEBUG) {
                    console.warn('Invariant violated. Retried category fetch. DEBUG ME.');
                }

                return;
            }

            this.categoriesAddedPromiseMap[key] = this.fetchCategoriesAdded(oldid, curid);
        },
        fetchCategoriesAdded: function(oldid, curid) {
            return Promise.all([
                this.fetchCategories(oldid),
                this.fetchCategories(curid),
            ]).then(function(both) {
                var oldCategories = both[0];
                var curCategories = both[1];
                var addedCategories = [];

                curCategories.forEach(function(cat) {
                    if (!oldCategories.includes(cat)) {
                        addedCategories.push(cat);
                    }
                });

                return addedCategories;
            });
        },
        fetchCategories: function(revid) {
            return this.api.get({
                action: 'parse',
                oldid: revid,
                prop: 'categories'
            }).then(function(response) {
                return response.parse.categories.map(function(cat) {
                    return cat['*'];
                });
            });
        },
        onDiscussionsLoaded: function(response) {
            var posts = response['doc:posts'];
            var i = posts.length;

            while (i--) {
                var post = posts[i];

                var existed = this.cachedDiscussionsPostMap.hasOwnProperty(post.id);
                var latestRevision = post._embedded.latestRevision[0];

                if (existed) {
                    var slimPost = this.cachedDiscussionsPostMap[post.id];
                    var isNewRevision = latestRevision.id !== slimPost.revisions[0].id;

                    if (isNewRevision) {
                        slimPost.revisions.unshift(
                            this.postRevisionToSlim(latestRevision, slimPost.author, slimPost.createdAt, post.isDeleted)
                        );

                        this.cachedDiscussionsEvents.unshift(this.slimPostToEvent(slimPost));
                    }
                } else {
                    var slimPost = {
                        id: post.id,
                        author: post.createdBy.name,
                        createdAt: post.creationDate.epochSecond,
                        forumName: post.forumName,
                        revisions: [
                            this.postRevisionToSlim(latestRevision, post.createdBy.name, post.creationDate.epochSecond, post.isDeleted)
                        ]
                    };

                    this.cachedDiscussionsPostMap[slimPost.id] = slimPost;
                    this.cachedDiscussionsEvents.unshift(this.slimPostToEvent(slimPost));
                }
            }

            if (this.cachedDiscussionsEvents.length > this.limit) {
                this.cachedDiscussionsEvents = this.cachedDiscussionsEvents.slice(0, this.limit);
            }

            // Cache avatars
            response.contributors[0].userInfo.forEach(function(contributor) {
                this.cachedAvatarMap[contributor.name] = contributor.avatarUrl;
            }.bind(this));
        },
        postRevisionToSlim: function(rev, author, createdAt, isDeleted) {
            return {
                id: rev.id,
                author: author,
                createdAt: rev.creationDate.epochSecond,
                initial: rev.creationDate.epochSecond === createdAt,
                isDeleted: isDeleted,
                jsonModel: JSON.parse(rev.jsonModel),
                rawContent: rev.rawContent
            };
        },
        // Convert a slim post object to an event object
        slimPostToEvent: function(post) {
            var rev = post.revisions[0];
            var type = rev.initial
                ? 'discussions-post'
                : 'discussions-edit';

            return {
                type: type,
                id: rev.id,
                time: rev.createdAt * 1000,
                post: post,
                rev: rev
            };
        },
        recentChangeToEvent: function(change) {
            var type = '';
            var id = '';

            switch (change.type) {
                case 'edit':
                    type = 'rc-edit';
                    id = change.rcid.toString();
                    break;
                case 'new':
                    type = 'rc-new';
                    id = change.rcid.toString();
                    break;
                case 'log':
                    type = 'rc-log';
                    id = change.rcid.toString();
                    break;
                default:
                    console.log(change);
                    throw new Error('Unhandled RC type: ' + change.type);
            }

            return {
                type: type,
                id: id,
                time: new Date(change.timestamp).getTime(),
                payload: change
            };
        },
        computeCombinedCachedEvents: function() {
            var rc = this.cachedRecentChangeEvents;
            var d = this.cachedDiscussionsEvents;

            var cached = this.mergeSortedArrays(rc, d, function(a, b) {
                return a.time - b.time;
            });

            if (this.DEBUG) {
                var cached2 = rc.concat(d).sort(function(a, b) {
                    return a.time - b.time;
                });

                console.log(cached, cached2);
            }

            this.cachedCombinedEvents = cached.slice(0, this.limit);
        },
        // Merges two sorted arrays according to `sortFn` sorta efficiently
        mergeSortedArrays: function(a1, a2, sortFn) {
            var a3 = [];

            var n1 = a1.length, n2 = a2.length;
            var i = 0, j = 0, k = 0;

            // Traverse both arrays
            while (i < n1 && j < n2) {
                if (sortFn(a1[i], a2[j]) > 0) {
                    a3[k++] = a1[i++];
                } else {
                    a3[k++] = a2[j++];
                }
            }

            // Store remaining elements of first array
            while (i < n1) {
                a3[k++] = a1[i++];
            }

            // Store remaining elements of second array
            while (j < n2) {
                a3[k++] = a2[j++];
            }

            return a3;
        },
        showBlockModal: function(username) {
            var modal = this.showModal({
                id: 'BlockModal',
                title: this.i18n.msg('block-title', username).plain(),
                content: {
                    type: 'div',
                    attr: {
                        id: 'AjaxBlockModalContent'
                    },
                    children: [
                        {
                            type: 'div',
                            attr: {
                                id: 'AjaxBlockExpiryWrapper'
                            },
                            children: [
                                this.i18n.msg('expiry').plain(),
                                {
                                    type: 'select',
                                    attr: {
                                        id: 'AjaxBlockExpirySelect'
                                    },
                                    children: this.buildSelectChildren(this.expiryTimes)
                                },
                                {
                                    type: 'input',
                                    attr: {
                                        id: 'AjaxBlockExpiryInput'
                                    }
                                }
                            ]
                        },
                        {
                            type: 'div',
                            attr: {
                                id: 'AjaxBlockReasonWrapper'
                            },
                            children: [
                                this.i18n.msg('reason').plain(),
                                {
                                    type: 'select',
                                    attr: {
                                        id: 'AjaxBlockReasonSelect'
                                    },
                                    children: this.buildSelectChildren(this.blockReasons)
                                },
                                {
                                    type: 'input',
                                    attr: {
                                        id: 'AjaxBlockReasonInput'
                                    }
                                }
                            ]
                        },
                        {
                            type: 'div',
                            attr: {
                                id: 'AjaxBlockCheckers'
                            },
                            children: [
                                this.buildCheckbox({
                                    id: 'AjaxBlockDisableWall',
                                    checked: this.check.talk,
                                    label: this.i18n.msg('label-disable-wall').plain()
                                }),
                                this.buildCheckbox({
                                    id: 'AjaxBlockAutoBlock',
                                    checked: this.check.autoblock || this.check.autoBlock,
                                    label: this.i18n.msg('label-auto-block').plain()
                                }),
                                this.buildCheckbox({
                                    id: 'AjaxBlockDisableAccount',
                                    checked: this.check.nocreate || this.check.noCreate,
                                    label: this.i18n.msg('label-no-create').plain()
                                }),
                                this.buildCheckbox({
                                    id: 'AjaxBlockOverrideBlock',
                                    checked: this.check.override,
                                    label: this.i18n.msg('label-override').plain()
                                })
                            ]
                        }
                    ]
                },
                buttons: [
                    {
                        event: 'block',
                        primary: true,
                        text: this.i18n.msg('block-button').plain()
                    },
                    {
                        event: 'close',
                        primary: false,
                        text: this.i18n.msg('cancel-button').plain()
                    }
                ],
                events: {
                    block: function() {
                        var state = this.getModalState(username);

                        if (state.expiry === '') {
                            this.notify({
                                type: 'warn',
                                text: this.i18n.msg('error-no-expiry').plain()
                            });
                            return;
                        }

                        this.block(state).then(function(data) {
                            modal.close();

                            if (data.error) {
                                this.notify({
                                    type: 'error',
                                    text: this.i18n.msg('error-block', username, data.error.info).plain()
                                });
                            } else {
                                this.notify({
                                    type: 'confirm',
                                    text: this.i18n.msg('success-block', username).plain()
                                });
                            }
                        }.bind(this)).fail(function(code, data) {
                            modal.close();

                            var error = data.error && data.error.info || code;

                            this.notify({
                                type: 'error',
                                text: this.i18n.msg('error-unblock', username, error).plain()
                            });
                        }.bind(this));
                    }.bind(this)
                }
            });
        },
        showModal: function(options) {
            if (dev.modal.modals.hasOwnProperty(options.id)) {
                dev.modal.modals[options.id]._modal.$element.closest('.modal-blackout, .oo-ui-window').remove();
                delete dev.modal.modals[options.id];
            }

            var modal = new dev.modal.Modal({
                id: options.id,
                size: 'medium',
                title: options.title,
                content: options.content,
                buttons: options.buttons,
                events: options.events
            });

            modal.create();
            modal.show();

            return modal;
        },

        // Entrypoint
        init: function() {

        },

        // Cleanup function
        cleanup: function() {

        }
    }, window.STALKER);

    if (!STALKER.shouldRun()) return;

    STALKER.preload();
})();
