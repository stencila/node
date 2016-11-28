const ComponentConverter = require('../component/ComponentConverter')

class DocumentHtmlBodyConverter extends ComponentConverter {

  dump (document, format, options) {
    return `<main id="data" data-format="html">
      <div class="content">${document.dump('html')}</div>
      <div class="sessions">${document.sessions.map(session => { return session.dump('html') }).join()}</div>
    </main>`
  }

}

module.exports = DocumentHtmlBodyConverter
