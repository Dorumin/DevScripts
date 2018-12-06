/**
 * AjaxDelete
 *
 * Allows to delete pages (through ?action=delete links) without leaving the current page.
 * Supports deleting revisions and restoring pages (does not support restoring individual revisions)
 * For personal use
 * @author Dorumin
 * @author KockaAdmiralac
 */

mw.loader.using(['mediawiki.api']).then(function() {
    mw.hook('dev.i18n').add(function(lib) {
        lib.loadMessages('AjaxDelete').then(AjaxDelete.init.bind(AjaxDelete));
    });
});