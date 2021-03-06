const path = require('path')

const {
  isComponent
} = require('./util')

const {
  removeExt
} = require('../../uni-cli-shared/lib/util')

const {
  getAutoComponents
} = require('../../uni-cli-shared/lib/pages')

const {
  updateUsingAutoImportComponents
} = require('../../uni-cli-shared/lib/cache')

function formatSource (source) {
  if (source.indexOf('@/') === 0) { // 根目录
    source = source.replace('@/', '')
  } else { // node_modules
    if (process.env.UNI_PLATFORM === 'mp-alipay') {
      if (source.indexOf('@') === 0) {
        source = source.replace('@', 'npm-scope-')
      }
    }
    source = 'node-modules/' + source
  }
  return removeExt(source)
}

function getWebpackChunkName (source) {
  return formatSource(source)
}

function updateMPUsingAutoImportComponents (autoComponents, options) {
  if (!options.resourcePath) {
    return
  }
  const resourcePath = options.resourcePath.replace(path.extname(options.resourcePath), '')
  const usingAutoImportComponents = Object.create(null)
  autoComponents.forEach(({
    name,
    source
  }) => {
    usingAutoImportComponents[name] = '/' + formatSource(source)
  })
  updateUsingAutoImportComponents(resourcePath, usingAutoImportComponents) // 更新json
}

function generateAutoComponentsCode (autoComponents, dynamic = false) {
  const components = []
  autoComponents.forEach(({
    name,
    source
  }) => {
    if (dynamic) {
      components.push(`'${name}': ()=>import(/* webpackChunkName: "${getWebpackChunkName(source)}" */'${source}')`)
    } else {
      components.push(`'${name}': require('${source}').default`)
    }
  })
  return `var components = {${components.join(',')}}`
}

function compileTemplate (source, options, compile) {
  const res = compile(source, options)
  const autoComponents = getAutoComponents([...(options.isUnaryTag.autoComponents || [])])
  if (autoComponents.length) {
    // console.log('检测到的自定义组件:' + JSON.stringify(autoComponents))
    res.components = generateAutoComponentsCode(autoComponents, options.mp)
  } else {
    res.components = 'var components;'
  }
  if (options.mp) { // 小程序 更新 json 每次编译都要调整,保证热更新时增减组件一致
    updateMPUsingAutoImportComponents(autoComponents || [], options)
  }
  return res
}

const compilerModule = {
  preTransformNode (el, options) {
    if (isComponent(el.tag) && el.tag !== 'App') { // App.vue
      // 挂在 isUnaryTag 上边,可以保证外部访问到
      (options.isUnaryTag.autoComponents || (options.isUnaryTag.autoComponents = new Set())).add(el.tag)
    }
  }
}
module.exports = {
  compileTemplate,
  module: compilerModule
}
