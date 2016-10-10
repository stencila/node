const ComponentConverter = require('./ComponentConverter')

class ComponentHtmlConverter extends ComponentConverter {

  dump (component, format, options) {
    return htmlify(component.dump('data'))
  }

}

function htmlify (obj) {
  if (obj instanceof Array) {
    let ol = '<ol>'
    for (let child of obj) {
      ol += `<li>${htmlify(child)}</li>`
    }
    return ol + '</ol>'
  } else if (obj instanceof Object && !(obj instanceof String)) {
    let ul = '<ul>'
    for (let name in obj) {
      ul += `<li>${name} : ${htmlify(obj[name])}</li>`
    }
    return ul + '</ul>'
  } else {
    return obj.toString()
  }
}

module.exports = ComponentHtmlConverter
