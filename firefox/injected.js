/*
 Copyright (C) 2017-present  John Berlin <n0tan3rd@gmail.com>
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

function inject () {
  console.log('injected')

  class GenericIARewritter {
    constructor (match, debug) {
      this._isSave = match.isSave
      this._prefixes = {
        http: 'http://',
        https: 'https://',
        schemeLess: '//',
        relative: '/'
      }
      if (!match.isSave) {
        let [pathName, beginPrefix, timestamp, archivedPath] = match.match
        this._timestamp = timestamp
        this._timestampPath = `/${timestamp}/`
        this._replayDT = `${beginPrefix}${timestamp}/`
        this._prefixes.rewritten = [
          '//web.archive.org/web/',
          `${window.location.origin}`,
          `${window.location.origin}/web/`,
          `/${beginPrefix}${timestamp}/`,
          `https://web.archive.org/web/`,
          'https://archive.org'
        ]
        this._makeOriginalURLObject(archivedPath)

        this._prefixes.bad = [
          `http:http://`,
          `https:${window.location.origin}`,
          `https:/${window.location.origin}`,
          `http:/${window.location.origin}`,
          `https://${window.location.origin}`,
          `http://${window.location.origin}`
        ]
      } else {
        let [pathName, archivedPath] = match.match
        this._prefixes.rewritten = [
          `${window.location.origin}`,
          '//web.archive.org/save/',
          `${window.location.origin}/save/`,
          '/save/_embed/',
          '//web.archive.org/web/',
          `${window.location.origin}/web/`,
          `https://web.archive.org/web/`,
          'https://archive.org'
        ]
        this._makeOriginalURLObject(archivedPath)
      }
      this._debug = debug
      this._prefixes.notIgnored = [
        this._prefixes.http,
        this._prefixes.https,
        this._prefixes.schemeLess
      ]
      this._prefixes.ignored = [
        '#',
        'about:',
        'data:',
        'mailto:',
        'javascript:',
        '{',
        '*'
      ]
      this._prefixes.iaInternals = [
        '/__wb/',
        '//analytics.archive.org',
        '/web/*/'
      ]
      this.tagToMod = {
        a: { href: undefined },
        area: { href: undefined },
        link: { href: 'cs_' },
        img: { src: 'im_', srcset: 'im_' },
        iframe: { src: 'if_' },
        frame: { src: 'if_' },
        script: { src: 'js_' },
        video: { src: 'oe_', poster: 'im_' },
        audio: { src: 'oe_', poster: 'im_' },
        source: { src: 'oe_', srcset: 'oe_' },
        input: { src: 'oe_' },
        embed: { src: 'oe_' },
        object: { data: 'oe_' },
        base: { href: 'mp_' },
        meta: { content: 'mp_' },
        form: { action: 'mp_' },
        track: { src: 'oe_' }
      }

      this._urlParser = new window.URL('about:blank')
      this.myCopySetAt = window.Element.prototype.setAttribute
      this.myCopyGetAt = window.Element.prototype.getAttribute
      this.STYLE_REGEX = /(url\s*\(\s*[\\"']*)([^)'"]+)([\\"']*\s*\))/gi
      this.IMPORT_REGEX = /(@import\s+[\\"']*)([^)'";]+)([\\"']*\s*;?)/gi
      this._originalRE = /\/web\/[0-9]+[a-z_]{0,3}\/(.+)/
      this.write_buff = null
      this.tagToModGs = {
        a: { href: { getter: null, setter: null } },
        area: { href: { getter: null, setter: null } },
        link: { href: { getter: null, setter: null } },
        img: {
          src: { getter: null, setter: null },
          srcset: { getter: null, setter: null }
        },
        iframe: { src: { getter: null, setter: null } },
        frame: { src: { getter: null, setter: null } },
        script: { src: { getter: null, setter: null } },
        video: {
          src: { getter: null, setter: null },
          poster: { getter: null, setter: null }
        },
        audio: {
          src: { getter: null, setter: null },
          poster: { getter: null, setter: null }
        },
        source: {
          src: { getter: null, setter: null },
          srcset: { getter: null, setter: null }
        },
        input: { src: { getter: null, setter: null } },
        embed: { src: { getter: null, setter: null } },
        object: { data: { getter: null, setter: null } },
        base: { href: { getter: null, setter: null } },
        meta: { content: { getter: null, setter: null } },
        form: { action: { getter: null, setter: null } },
        track: { src: { getter: null, setter: null } }
      }
      this.doRewrite = this.doRewrite.bind(this)
      this.rewriteSrcset = this.rewriteSrcset.bind(this)
      this.rewriteHTML = this.rewriteHTML.bind(this)
      this.rewriteStyle = this.rewriteStyle.bind(this)
      this.rewriteElementRecursive = this.rewriteElementRecursive.bind(this)
      this.rewriteURL = this.rewriteURL.bind(this)
      this.rewriteElement = this.rewriteElement.bind(this)
      this.replaceStyle = this.replaceStyle.bind(this)
    }

    _makeOriginalURLObject (archivedPath) {
      if (
        archivedPath.indexOf('http://') === -1 &&
        archivedPath.indexOf('https://') === -1
      ) {
        archivedPath = `${window.location.protocol}//${archivedPath}`
      }
      let wasError = false
      try {
        this._orginalURL = new window.URL(archivedPath)
      } catch (error) {
        wasError = true
      }
      if (wasError) {
        let pn = window.location.pathname
        let idx = pn.indexOf('http')
        if (idx === -1) {
          idx = pn.indexOf('www')
        }
        pn = pn.substr(idx)
        if (pn.indexOf('http://') === -1 && pn.indexOf('https://') === -1) {
          pn = `${window.location.protocol}//${archivedPath}`
        }
        this._orginalURL = new window.URL(pn)
      }
      this._originalPath = this._orginalURL.href
      try {
        this._originalDomain = this._orginalURL.host
      } catch (error) {
        this._originalDomain = window.location.host
      }
    }

    static init () {
      let match
      try {
        match = window.location.pathname.match(
          /(\/web\/)([0-9]+)(?:[a-z_]{0,3})\/(.+)/
        )
      } catch (error) {}
      if (match) {
        const rewriter = new GenericIARewritter({ match, isSave: false }, true)
        rewriter.overrides()
      } else {
        try {
          match = window.location.pathname.match(/\/save\/(?:_embeded\/)?(.+)/)
        } catch (error) {
          return
        }
        if (match) {
          const rewriter = new GenericIARewritter({ match, isSave: true }, true)
          rewriter.overrides()
        }
      }
    }

    isRewritable (url) {
      if (!url) return url
      let isRewritable = url.indexOf(this._prefixes.http) === 0
      if (isRewritable) return isRewritable
      return url.indexOf(this._prefixes.https) === 0
    }

    isRewritableWSchemeless (url) {
      if (!url) return url
      let isRewritable = url.indexOf(this._prefixes.schemeLess) === 0
      if (isRewritable) return isRewritable
      isRewritable = url.indexOf(this._prefixes.http) === 0
      if (isRewritable) return isRewritable
      return url.indexOf(this._prefixes.https) === 0
    }

    isIAInternal (url) {
      let i = 0
      let len = this._prefixes.iaInternals.length
      let isInternal = false
      while (i < len) {
        isInternal = url.indexOf(this._prefixes.iaInternals[i]) === 0
        if (isInternal) return isInternal
        i++
      }
      return isInternal
    }

    shouldIgnore (url) {
      let i = 0
      let len = this._prefixes.ignored.length
      let ignored = false
      while (i < len) {
        // perf String.prototype.startsWith slow
        ignored = url.indexOf(this._prefixes.ignored[i]) === 0
        if (ignored) return ignored
        i++
      }
      return ignored
    }

    isAlreadyRewritten (url) {
      let i = 0
      let len = this._prefixes.rewritten.length
      let isRewritten = false
      while (i < len) {
        // perf String.prototype.startsWith slow
        isRewritten = url.indexOf(this._prefixes.rewritten[i]) === 0
        if (isRewritten) return isRewritten
        i++
      }
      if (!isRewritten) {
        isRewritten =
          url.match(/^\/web\/[0-9]+[a-z_]{0,3}\//) !== null ||
          url.match(/^\/save\/(?:_embeded\/)?(.+)/) !== null
      }
      return isRewritten
    }

    doRewrite (url, mod) {
      let maybeRewritten = this.rewriteURL(url, mod)
      if (url !== maybeRewritten) {
        console.log(`REWRITE: ${url} -> ${maybeRewritten}`)
      } else {
        if (url == null) {
          // console.trace(`Not rewritten: ${url}`)
        } else {
          // console.log(`Not rewritten: ${url}`)
        }
        console.log(`Not rewritten: ${url}`)
      }
      return maybeRewritten
    }

    getOriginal (url) {
      if (!url) return url
      url = url.toString()
      if (this.shouldIgnore(url)) return url
      this._urlParser.href = url
      let match = this._urlParser.pathname.match(this._originalRE)
      if (match) return match[1]
      return url
    }

    rewriteURL (url, mod) {
      if (url == null) return url
      const urlType = typeof url
      if (urlType === 'object') {
        url = url.toString()
      } else if (urlType !== 'string') {
        return url
      }

      if (this.shouldIgnore(url)) {
        return url
      }
      if (this.isIAInternal(url)) {
        return url
      }
      if (this.isAlreadyRewritten(url)) {
        return url
      }
      let begin
      if (this._isSave) {
        begin = `${window.location.origin}/save/_embed`
      } else {
        begin = `${window.location.origin}/web/${this._timestamp}${mod || ''}`
      }
      if (url[0] === '/' && url.indexOf(this._prefixes.schemeLess) !== 0) {
        if (this._originalPath[this._originalPath.length - 1] === '/') {
          url = url.substr(1)
        }
        return `${begin}/${this._originalPath}${url}`
      }

      if (url[0] === '.') {
        let temp = new window.URL(url, this._originalPath)
        url = temp.href
      }

      if (url.indexOf(this._prefixes.schemeLess) === 0) {
        return `${begin}/${this._orginalURL.protocol}${url}`
      }

      if (this.isRewritable(url)) {
        return `${begin}/${url}`
      }

      return url
    }

    debugRewriteURL (url, mod) {
      let maybeRewritten = this.rewriteURL(url, mod)
      if (url !== maybeRewritten) {
        console.log(`REWRITE: ${url} -> ${maybeRewritten}`)
      } else {
        console.log(`Not rewritten: ${url}`)
      }
      return maybeRewritten
    }

    overrideXMLHTTPAndFetch () {
      const rewriter = this
      if (window.fetch) {
        const originalFetch = window.fetch
        window.fetch = function fetch (input, opts) {
          const inputType = typeof input
          if (inputType === 'string') {
            input = rewriter.doRewrite(input)
          } else if (inputType === 'object' && input.url) {
            let maybeRewritten = rewriter.doRewrite(input.url)
            if (maybeRewritten !== input.url) {
              input = new Request(maybeRewritten, input)
            }
          } else if (inputType === 'object' && input.href) {
            let maybeRewritten = rewriter.doRewrite(input.href)
            if (maybeRewritten !== input.href) {
              input = new Request(maybeRewritten, input)
            }
          }
          return originalFetch.call(this, input, opts)
        }
      }
      if (window.Request) {
        const inputInterceptor = input => {
          const inputType = typeof input
          if (inputType === 'string') {
            input = this.doRewrite(input)
          } else if (inputType === 'object' && input.url) {
            let maybeRewritten = this.doRewrite(input.url)
            if (maybeRewritten !== input.url) {
              input.url = maybeRewritten
            }
          }
          return input
        }

        class NewRequest extends Request {
          constructor (input, opts) {
            super(inputInterceptor(input), opts)
          }
        }

        window.Request = NewRequest
      }
      if (window.Response) {
        class NResponse extends window.Response {
          redirect (url, status) {
            return super.redirect(rewriter.doRewrite(url), status)
          }
        }

        window.Response = NResponse
      }
      if (window.XMLHttpRequest) {
        class NewXMLHttpRequest extends XMLHttpRequest {
          open (method, url, async, user, password) {
            if (!this._no_rewrite) {
              url = rewriter.doRewrite(url)
            }
            if (async !== false) {
              async = true
            }
            super.open(method, url, async, user, password)
          }
        }

        window.XMLHttpRequest = NewXMLHttpRequest
      }
    }

    defineProperty (obj, prop, setter, getter, enumerable) {
      let existingDescriptor = Object.getOwnPropertyDescriptor(obj, prop)
      if (existingDescriptor && !existingDescriptor.configurable) return
      if (!getter) return
      try {
        let descriptor = {
          configurable: true,
          enumerable: enumerable || false,
          get: getter
        }
        if (setter) {
          descriptor.set = setter
        }
        Object.defineProperty(obj, prop, descriptor)
        return true
      } catch (e) {
        return false
      }
    }

    defineProperty2 (obj, prop, getter, setter, enumerable) {
      let existingDescriptor = Object.getOwnPropertyDescriptor(obj, prop)
      if (existingDescriptor && !existingDescriptor.configurable) return
      if (!getter) return
      try {
        let descriptor = {
          configurable: true,
          enumerable: enumerable || false,
          get: getter
        }
        if (setter) {
          descriptor.set = setter
        }
        Object.defineProperty(obj, prop, descriptor)
        return true
      } catch (e) {
        return false
      }
    }

    rewriteDataAttribute (dAtt, propValue) {
      if (this.isRewritableWSchemeless(propValue)) {
        return this.doRewrite(propValue)
      }
      // best guesses
      if (dAtt.indexOf('src') !== -1) {
        return this.doRewrite(propValue)
      }
      if (dAtt.indexOf('style') !== -1) {
        return this.rewriteInlineStyle(propValue)
      }
      return propValue
    }

    overrides () {
      this.overrideXMLHTTPAndFetch()
      const rewriter = this
      Object.defineProperty(window.document, 'domain', {
        configurable: true,
        enumerable: false,
        set () {},
        get () {
          return rewriter._orginalURL.host
        }
      })
      if (window.Attr) {
        const ogetNodeValue = rewriter.getOGetter(
          window.Attr.prototype,
          'nodeValue'
        )
        const ogetValue = rewriter.getOGetter(window.Attr.prototype, 'value')
        rewriter.defineProperty(
          window.Attr.prototype,
          'nodeValue',
          undefined,
          function () {
            const result = ogetNodeValue.call(this)
            const tagName = this.ownerElement && this.ownerElement.tagName
            if (
              rewriter.shouldRewriteAttribute(
                tagName,
                this.nodeName.toLowerCase()
              )
            ) {
              return rewriter.doRewrite(
                result,
                tagName === 'SCRIPT' ? 'js_' : undefined
              )
            }
            return result
          }
        )
        rewriter.defineProperty(
          window.Attr.prototype,
          'value',
          undefined,
          function () {
            const result = ogetValue.call(this)
            const tagName = this.ownerElement && this.ownerElement.tagName
            if (
              rewriter.shouldRewriteAttribute(
                tagName,
                this.nodeName.toLowerCase()
              )
            ) {
              return rewriter.doRewrite(
                result,
                tagName === 'SCRIPT' ? 'js_' : undefined
              )
            }
            return result
          }
        )
      }
      if (window.Node) {
        const ap = window.Node.prototype.appendChild
        window.Node.prototype.appendChild = function appendChild (newC) {
          if (newC) {
            if (newC.nodeType === Node.ELEMENT_NODE) {
              rewriter.rewriteElement(newC)
              rewriter.rewriteElementRecursive(newC)
            } else if (newC.nodeType === Node.TEXT_NODE) {
              if (this.tagName === 'STYLE') {
                newC.textContent = rewriter.rewriteStyle(newC.textContent)
              }
            } else if (newC.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
              rewriter.rewriteElementRecursive(newC)
            }
          }
          return ap.call(this, newC)
        }
        const ib = window.Node.prototype.insertBefore
        window.Node.prototype.insertBefore = function insertBefore (newC, ref) {
          if (newC) {
            if (newC.nodeType === Node.ELEMENT_NODE) {
              rewriter.rewriteElement(newC)
              rewriter.rewriteElementRecursive(newC)
            } else if (newC.nodeType === Node.TEXT_NODE) {
              if (this.tagName === 'STYLE') {
                newC.textContent = rewriter.rewriteStyle(newC.textContent)
              }
            } else if (newC.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
              rewriter.rewriteElementRecursive(newC)
            }
          }
          return ib.call(this, newC, ref)
        }
        const rc = window.Node.prototype.replaceChild
        window.Node.prototype.replaceChild = function replaceChild (newC, oldC) {
          if (newC) {
            if (newC.nodeType === Node.ELEMENT_NODE) {
              rewriter.rewriteElement(newC)
              rewriter.rewriteElementRecursive(newC)
            } else if (newC.nodeType === Node.TEXT_NODE) {
              if (this.tagName === 'STYLE') {
                newC.textContent = rewriter.rewriteStyle(newC.textContent)
              }
            } else if (newC.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
              rewriter.rewriteElementRecursive(newC)
            }
          }
          return rc.call(this, newC, oldC)
        }
      }

      if (window.HTMLAnchorElement && window.HTMLAnchorElement.prototype) {
        const getOHREF = rewriter.getOGetter(
          window.HTMLAnchorElement.prototype,
          'href'
        )
        rewriter.tagToModGs.a.href.getter = getOHREF
        const setOHREF = rewriter.getOSetter(
          window.HTMLAnchorElement.prototype,
          'href'
        )
        rewriter.tagToModGs.a.href.setter = setOHREF
        rewriter.defineProperty2(
          window.HTMLAnchorElement.prototype,
          'href',
          function () {
            let propValue

            if (getOHREF) {
              propValue = getOHREF.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'href')
            }

            return propValue
          },
          function (href) {
            if (this._no_rewrite) {
              if (setOHREF) {
                return setOHREF.call(this, href)
              } else {
                return rewriter.myCopySetAt.call(this, 'href', href)
              }
            }

            if (setOHREF) {
              return setOHREF.call(this, rewriter.doRewrite(href))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'href',
                rewriter.doRewrite(href)
              )
            }
          }
        )
      }

      if (window.HTMLAreaElement && window.HTMLAreaElement.prototype) {
        const getOHREF = rewriter.getOGetter(
          window.HTMLAreaElement.prototype,
          'href'
        )
        rewriter.tagToModGs.area.href.getter = getOHREF
        const setOHREF = rewriter.getOSetter(
          window.HTMLAreaElement.prototype,
          'href'
        )
        rewriter.tagToModGs.area.href.setter = setOHREF
        rewriter.defineProperty2(
          window.HTMLAreaElement.prototype,
          'href',
          function () {
            let propValue

            if (getOHREF) {
              propValue = getOHREF.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'href')
            }

            return propValue
          },
          function (href) {
            if (this._no_rewrite) {
              if (setOHREF) {
                return setOHREF.call(this, href)
              } else {
                return rewriter.myCopySetAt.call(this, 'href', href)
              }
            }

            if (setOHREF) {
              return setOHREF.call(this, rewriter.doRewrite(href))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'href',
                rewriter.doRewrite(href)
              )
            }
          }
        )
      }

      if (window.HTMLBaseElement && window.HTMLBaseElement.prototype) {
        const getOHREF = rewriter.getOGetter(
          window.HTMLBaseElement.prototype,
          'href'
        )
        rewriter.tagToModGs.base.href.getter = getOHREF
        const setOHREF = rewriter.getOSetter(
          window.HTMLBaseElement.prototype,
          'href'
        )
        rewriter.tagToModGs.base.href.setter = setOHREF
        rewriter.defineProperty2(
          window.HTMLBaseElement.prototype,
          'href',
          function () {
            let propValue

            if (getOHREF) {
              propValue = getOHREF.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'href')
            }

            return propValue
          },
          function (href) {
            if (this._no_rewrite) {
              if (setOHREF) {
                return setOHREF.call(this, href)
              } else {
                return rewriter.myCopySetAt.call(this, 'href', href)
              }
            }

            if (setOHREF) {
              return setOHREF.call(this, rewriter.doRewrite(href, 'mp_'))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'href',
                rewriter.doRewrite(href, 'mp_')
              )
            }
          }
        )
      }

      if (window.HTMLEmbedElement && window.HTMLEmbedElement.prototype) {
        const getOSRC = rewriter.getOGetter(
          window.HTMLEmbedElement.prototype,
          'src'
        )
        rewriter.tagToModGs.embed.src.getter = getOSRC
        const setOSRC = rewriter.getOSetter(
          window.HTMLEmbedElement.prototype,
          'src'
        )
        rewriter.tagToModGs.embed.src.setter = setOSRC
        rewriter.defineProperty2(
          window.HTMLEmbedElement.prototype,
          'src',
          function () {
            let propValue

            if (getOSRC) {
              propValue = getOSRC.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'src')
            }

            return propValue
          },
          function (src) {
            if (this._no_rewrite) {
              if (setOSRC) {
                return setOSRC.call(this, src)
              } else {
                return rewriter.myCopySetAt.call(this, 'src', src)
              }
            }

            if (setOSRC) {
              return setOSRC.call(this, rewriter.doRewrite(src, 'oe_'))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'src',
                rewriter.doRewrite(src, 'oe_')
              )
            }
          }
        )
      }

      if (window.HTMLFormElement && window.HTMLFormElement.prototype) {
        const getOACTION = rewriter.getOGetter(
          window.HTMLFormElement.prototype,
          'action'
        )
        rewriter.tagToModGs.form.action.getter = getOACTION
        const setOACTION = rewriter.getOSetter(
          window.HTMLFormElement.prototype,
          'action'
        )
        rewriter.tagToModGs.form.action.setter = setOACTION
        rewriter.defineProperty2(
          window.HTMLFormElement.prototype,
          'action',
          function () {
            let propValue

            if (getOACTION) {
              propValue = getOACTION.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'action')
            }

            return propValue
          },
          function (action) {
            if (this._no_rewrite) {
              if (setOACTION) {
                return setOACTION.call(this, action)
              } else {
                return rewriter.myCopySetAt.call(this, 'action', action)
              }
            }

            if (setOACTION) {
              return setOACTION.call(this, rewriter.doRewrite(action, 'mp_'))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'action',
                rewriter.doRewrite(action, 'mp_')
              )
            }
          }
        )
      }

      if (window.HTMLFrameElement && window.HTMLFrameElement.prototype) {
        const getOSRC = rewriter.getOGetter(
          window.HTMLFrameElement.prototype,
          'src'
        )
        rewriter.tagToModGs.frame.src.getter = getOSRC
        const setOSRC = rewriter.getOSetter(
          window.HTMLFrameElement.prototype,
          'src'
        )
        rewriter.tagToModGs.frame.src.setter = setOSRC
        rewriter.defineProperty2(
          window.HTMLFrameElement.prototype,
          'src',
          function () {
            let propValue

            if (getOSRC) {
              propValue = getOSRC.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'src')
            }

            return propValue
          },
          function (src) {
            if (this._no_rewrite) {
              if (setOSRC) {
                return setOSRC.call(this, src)
              } else {
                return rewriter.myCopySetAt.call(this, 'src', src)
              }
            }

            if (setOSRC) {
              return setOSRC.call(this, rewriter.doRewrite(src, 'if_'))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'src',
                rewriter.doRewrite(src, 'if_')
              )
            }
          }
        )
      }

      if (window.HTMLIFrameElement && window.HTMLIFrameElement.prototype) {
        const getOSRC = rewriter.getOGetter(
          window.HTMLIFrameElement.prototype,
          'src'
        )
        rewriter.tagToModGs.iframe.src.getter = getOSRC
        const setOSRC = rewriter.getOSetter(
          window.HTMLIFrameElement.prototype,
          'src'
        )
        rewriter.tagToModGs.iframe.src.setter = setOSRC
        rewriter.defineProperty2(
          window.HTMLIFrameElement.prototype,
          'src',
          function () {
            let propValue

            if (getOSRC) {
              propValue = getOSRC.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'src')
            }

            return propValue
          },
          function (src) {
            if (this._no_rewrite) {
              if (setOSRC) {
                return setOSRC.call(this, src)
              } else {
                return rewriter.myCopySetAt.call(this, 'src', src)
              }
            }

            if (setOSRC) {
              return setOSRC.call(this, rewriter.doRewrite(src, 'if_'))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'src',
                rewriter.doRewrite(src, 'if_')
              )
            }
          }
        )
      }

      if (window.HTMLImageElement && window.HTMLImageElement.prototype) {
        const getOSRC = rewriter.getOGetter(
          window.HTMLImageElement.prototype,
          'src'
        )
        rewriter.tagToModGs.img.src.getter = getOSRC
        const setOSRC = rewriter.getOSetter(
          window.HTMLImageElement.prototype,
          'src'
        )
        rewriter.tagToModGs.img.src.setter = setOSRC
        rewriter.defineProperty2(
          window.HTMLImageElement.prototype,
          'src',
          function () {
            let propValue

            if (getOSRC) {
              propValue = getOSRC.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'src')
            }

            return propValue
          },
          function (src) {
            if (this._no_rewrite) {
              if (setOSRC) {
                return setOSRC.call(this, src)
              } else {
                return rewriter.myCopySetAt.call(this, 'src', src)
              }
            }

            if (setOSRC) {
              return setOSRC.call(this, rewriter.doRewrite(src, 'im_'))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'src',
                rewriter.doRewrite(src, 'im_')
              )
            }
          }
        )
        const getOSRCSET = rewriter.getOGetter(
          window.HTMLImageElement.prototype,
          'srcset'
        )
        rewriter.tagToModGs.img.srcset.getter = getOSRCSET
        const setOSRCSET = rewriter.getOSetter(
          window.HTMLImageElement.prototype,
          'srcset'
        )
        rewriter.tagToModGs.img.srcset.setter = setOSRCSET
        rewriter.defineProperty2(
          window.HTMLImageElement.prototype,
          'srcset',
          function () {
            let propValue

            if (getOSRCSET) {
              propValue = getOSRCSET.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'srcset')
            }

            return propValue
          },
          function (srcset) {
            if (this._no_rewrite) {
              if (setOSRCSET) {
                return setOSRCSET.call(this, srcset)
              } else {
                return rewriter.myCopySetAt.call(this, 'srcset', srcset)
              }
            }

            return rewriter.getOriginal(
              setOSRCSET.call(this, rewriter.rewriteSrcset(srcset))
            )
          }
        )
      }

      if (window.HTMLInputElement && window.HTMLInputElement.prototype) {
        const getOSRC = rewriter.getOGetter(
          window.HTMLInputElement.prototype,
          'src'
        )
        rewriter.tagToModGs.input.src.getter = getOSRC
        const setOSRC = rewriter.getOSetter(
          window.HTMLInputElement.prototype,
          'src'
        )
        rewriter.tagToModGs.input.src.setter = setOSRC
        rewriter.defineProperty2(
          window.HTMLInputElement.prototype,
          'src',
          function () {
            let propValue

            if (getOSRC) {
              propValue = getOSRC.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'src')
            }

            return propValue
          },
          function (src) {
            if (this._no_rewrite) {
              if (setOSRC) {
                return setOSRC.call(this, src)
              } else {
                return rewriter.myCopySetAt.call(this, 'src', src)
              }
            }

            if (setOSRC) {
              return setOSRC.call(this, rewriter.doRewrite(src, 'oe_'))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'src',
                rewriter.doRewrite(src, 'oe_')
              )
            }
          }
        )
      }

      if (window.HTMLLinkElement && window.HTMLLinkElement.prototype) {
        const getOHREF = rewriter.getOGetter(
          window.HTMLLinkElement.prototype,
          'href'
        )
        rewriter.tagToModGs.link.href.getter = getOHREF
        const setOHREF = rewriter.getOSetter(
          window.HTMLLinkElement.prototype,
          'href'
        )
        rewriter.tagToModGs.link.href.setter = setOHREF
        rewriter.defineProperty2(
          window.HTMLLinkElement.prototype,
          'href',
          function () {
            let propValue

            if (getOHREF) {
              propValue = getOHREF.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'href')
            }

            return propValue
          },
          function (href) {
            if (this._no_rewrite) {
              if (setOHREF) {
                return setOHREF.call(this, href)
              } else {
                return rewriter.myCopySetAt.call(this, 'href', href)
              }
            }

            if (href.indexOf('data:text/css') === 0) {
              href = rewriter.rewriteInlineStyle(href)
            } else {
              href = rewriter.doRewrite(href, 'cs_')
            }

            if (setOHREF) {
              return setOHREF.call(this, href)
            } else {
              return rewriter.myCopySetAt.call(this, 'href', href)
            }
          }
        )
      }

      if (window.HTMLMetaElement && window.HTMLMetaElement.prototype) {
        const getOCONTENT = rewriter.getOGetter(
          window.HTMLMetaElement.prototype,
          'content'
        )
        rewriter.tagToModGs.meta.content.getter = getOCONTENT
        const setOCONTENT = rewriter.getOSetter(
          window.HTMLMetaElement.prototype,
          'content'
        )
        rewriter.tagToModGs.meta.content.setter = setOCONTENT
        rewriter.defineProperty2(
          window.HTMLMetaElement.prototype,
          'content',
          function () {
            let propValue

            if (getOCONTENT) {
              propValue = getOCONTENT.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'content')
            }

            return propValue
          },
          function (content) {
            if (this._no_rewrite) {
              if (setOCONTENT) {
                return setOCONTENT.call(this, content)
              } else {
                return rewriter.myCopySetAt.call(this, 'content', content)
              }
            }

            if (setOCONTENT) {
              return setOCONTENT.call(this, rewriter.doRewrite(content, 'mp_'))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'content',
                rewriter.doRewrite(content, 'mp_')
              )
            }
          }
        )
      }

      if (window.HTMLObjectElement && window.HTMLObjectElement.prototype) {
        const getODATA = rewriter.getOGetter(
          window.HTMLObjectElement.prototype,
          'data'
        )
        rewriter.tagToModGs.object.data.getter = getODATA
        const setODATA = rewriter.getOSetter(
          window.HTMLObjectElement.prototype,
          'data'
        )
        rewriter.tagToModGs.object.data.setter = setODATA
        rewriter.defineProperty2(
          window.HTMLObjectElement.prototype,
          'data',
          function () {
            let propValue

            if (getODATA) {
              propValue = getODATA.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'data')
            }

            return propValue
          },
          function (data) {
            if (this._no_rewrite) {
              if (setODATA) {
                return setODATA.call(this, data)
              } else {
                return rewriter.myCopySetAt.call(this, 'data', data)
              }
            }

            if (setODATA) {
              return setODATA.call(this, rewriter.doRewrite(data, 'oe_'))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'data',
                rewriter.doRewrite(data, 'oe_')
              )
            }
          }
        )
      }

      if (window.HTMLScriptElement && window.HTMLScriptElement.prototype) {
        const getOSRC = rewriter.getOGetter(
          window.HTMLScriptElement.prototype,
          'src'
        )
        rewriter.tagToModGs.script.src.getter = getOSRC
        const setOSRC = rewriter.getOSetter(
          window.HTMLScriptElement.prototype,
          'src'
        )
        rewriter.tagToModGs.script.src.setter = setOSRC
        rewriter.defineProperty2(
          window.HTMLScriptElement.prototype,
          'src',
          function () {
            let propValue

            if (getOSRC) {
              propValue = getOSRC.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'src')
            }

            return propValue
          },
          function (src) {
            if (this._no_rewrite) {
              if (setOSRC) {
                return setOSRC.call(this, src)
              } else {
                return rewriter.myCopySetAt.call(this, 'src', src)
              }
            }

            if (setOSRC) {
              return setOSRC.call(this, rewriter.doRewrite(src, 'js_'))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'src',
                rewriter.doRewrite(src, 'js_')
              )
            }
          }
        )
      }

      if (window.HTMLSourceElement && window.HTMLSourceElement.prototype) {
        const getOSRC = rewriter.getOGetter(
          window.HTMLSourceElement.prototype,
          'src'
        )
        rewriter.tagToModGs.source.src.getter = getOSRC
        const setOSRC = rewriter.getOSetter(
          window.HTMLSourceElement.prototype,
          'src'
        )
        rewriter.tagToModGs.source.src.setter = setOSRC
        rewriter.defineProperty2(
          window.HTMLSourceElement.prototype,
          'src',
          function () {
            let propValue

            if (getOSRC) {
              propValue = getOSRC.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'src')
            }

            return propValue
          },
          function (src) {
            if (this._no_rewrite) {
              if (setOSRC) {
                return setOSRC.call(this, src)
              } else {
                return rewriter.myCopySetAt.call(this, 'src', src)
              }
            }

            if (setOSRC) {
              return setOSRC.call(this, rewriter.doRewrite(src, 'oe_'))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'src',
                rewriter.doRewrite(src, 'oe_')
              )
            }
          }
        )
        const getOSRCSET = rewriter.getOGetter(
          window.HTMLSourceElement.prototype,
          'srcset'
        )
        rewriter.tagToModGs.source.srcset.getter = getOSRC
        const setOSRCSET = rewriter.getOSetter(
          window.HTMLSourceElement.prototype,
          'srcset'
        )
        rewriter.tagToModGs.source.srcset.setter = setOSRCSET
        rewriter.defineProperty2(
          window.HTMLSourceElement.prototype,
          'srcset',
          function () {
            let propValue

            if (getOSRCSET) {
              propValue = getOSRCSET.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'srcset')
            }

            return propValue
          },
          function (srcset) {
            if (this._no_rewrite) {
              if (setOSRCSET) {
                return setOSRCSET.call(this, srcset)
              } else {
                return rewriter.myCopySetAt.call(this, 'srcset', srcset)
              }
            }

            return rewriter.getOriginal(
              setOSRCSET.call(this, rewriter.rewriteSrcset(srcset))
            )
          }
        )
      }

      if (window.HTMLTrackElement && window.HTMLTrackElement.prototype) {
        const getOSRC = rewriter.getOGetter(
          window.HTMLTrackElement.prototype,
          'src'
        )
        rewriter.tagToModGs.track.src.getter = getOSRC
        const setOSRC = rewriter.getOSetter(
          window.HTMLTrackElement.prototype,
          'src'
        )
        rewriter.tagToModGs.track.src.setter = setOSRC
        rewriter.defineProperty2(
          window.HTMLTrackElement.prototype,
          'src',
          function () {
            let propValue

            if (getOSRC) {
              propValue = getOSRC.call(this)
            } else {
              propValue = rewriter.myCopyGetAt.call(this, 'src')
            }

            return rewriter.doRewrite(propValue, 'oe_')
          },
          function (src) {
            if (this._no_rewrite) {
              if (setOSRC) {
                return setOSRC.call(this, src)
              } else {
                return rewriter.myCopySetAt.call(this, 'src', src)
              }
            }

            if (setOSRC) {
              return setOSRC.call(this, rewriter.doRewrite(src, 'oe_'))
            } else {
              return rewriter.myCopySetAt.call(
                this,
                'src',
                rewriter.doRewrite(src, 'oe_')
              )
            }
          }
        )
      }

      if (window.Element && window.Element.prototype) {
        const oSetAttribute = window.Element.prototype.setAttribute
        const oGetAttribute = window.Element.prototype.getAttribute

        window.Element.prototype.setAttribute = function setAttribute (
          prop,
          value
        ) {
          if (prop && typeof value === 'string') {
            const propNameLower = prop.toLowerCase()
            const tagNameLower = this.tagName.toLowerCase()

            if (propNameLower === 'style') {
              value = rewriter.rewriteStyle(value)
            } else if (propNameLower === 'srcset') {
              value = rewriter.rewriteSrcset(value)
            } else if (tagNameLower === 'link' && propNameLower === 'href') {
              if (value.indexOf('data:text/css') === 0) {
                value = rewriter.rewriteInlineStyle(value)
              } else {
                value = rewriter.doRewrite(value)
              }
            } else if (propNameLower.indexOf('data-') === 0) {
              value = rewriter.rewriteDataAttribute(propNameLower, value)
            } else if (!this._no_rewrite) {
              const modifiers = rewriter.tagToMod[tagNameLower]

              if (modifiers) {
                value = rewriter.doRewrite(value, modifiers[propNameLower])
              } else if (propNameLower === 'src' || propNameLower === 'href') {
                value = rewriter.doRewrite(value)
              }
            }
          }

          return oSetAttribute.call(this, prop, value)
        }

        window.Element.prototype.getAttribute = function getAttribute (prop) {
          const result = oGetAttribute.call(this, prop)
          if (result == null) {
            return result
          }
          const propNameLower = prop.toLowerCase()
          const tagNameLower = this.tagName.toLowerCase()
          const modifiers = rewriter.tagToMod[tagNameLower]
          if (propNameLower.indexOf('data-') === 0) {
            return rewriter.rewriteDataAttribute(propNameLower, result)
          } else if (propNameLower === 'src' || propNameLower === 'href') {
            return rewriter.doRewrite(result)
          } else if (modifiers) {
            return rewriter.doRewrite(result, modifiers[propNameLower])
          }
          return result
        }

        const oinsertAdjacentHTML = window.Element.prototype.insertAdjacentHTML

        window.Element.prototype.insertAdjacentHTML = function insertAdjacentHTML (
          where,
          html
        ) {
          if (!this._no_rewrite) {
            return oinsertAdjacentHTML.call(
              this,
              where,
              rewriter.rewriteHTML(html)
            )
          }
          return oinsertAdjacentHTML.call(this, where, html)
        }

        const oinsertAdjacentElement =
          window.Element.prototype.insertAdjacentElement

        window.Element.prototype.insertAdjacentElement = function insertAdjacentElement (
          where,
          element
        ) {
          if (!this._no_rewrite) {
            rewriter.rewriteElement(element)
            rewriter.rewriteElementRecursive(element)
            return oinsertAdjacentElement.call(this, where, element)
          }
          return oinsertAdjacentElement.call(this, where, element)
        }
      }

      if (window.HTMLElement && window.HTMLElement.prototype) {
        const osetINNERHTML = rewriter.getOSetter(
          window.HTMLElement.prototype,
          'innerHTML'
        )

        if (osetINNERHTML) {
          const ogetINNERHTML = rewriter.getOGetter(
            window.HTMLElement.prototype,
            'innerHTML'
          )
          rewriter.defineProperty2(
            window.HTMLElement.prototype,
            'innerHTML',
            function () {
              let innerHTMLString = ogetINNERHTML.call(this)
              if (!this._no_rewrite) {
                let newString
                if (this.tagName === 'STYLE') {
                  newString = rewriter.rewriteStyle(innerHTMLString)
                } else {
                  newString = rewriter.rewriteHTML(innerHTMLString)
                }
                if (newString != null && newString !== innerHTMLString) {
                  return newString
                }
              }
              return innerHTMLString
            },
            function (htmlString) {
              if (!this._no_rewrite) {
                if (this.tagName === 'STYLE') {
                  htmlString = rewriter.rewriteStyle(htmlString)
                } else {
                  htmlString = rewriter.rewriteHTML(htmlString)
                }
              }

              return osetINNERHTML.call(this, htmlString)
            }
          )
        }

        const osetOUTERHTML = rewriter.getOSetter(
          window.HTMLElement.prototype,
          'outerHTML'
        )

        if (osetOUTERHTML) {
          const ogetOUTERHTML = rewriter.getOGetter(
            window.HTMLElement.prototype,
            'outerHTML'
          )
          rewriter.defineProperty2(
            window.HTMLElement.prototype,
            'outerHTML',
            function () {
              let outerHTMLString = ogetOUTERHTML.call(this)
              if (!this._no_rewrite) {
                let newString
                if (this.tagName === 'STYLE') {
                  newString = rewriter.rewriteStyle(outerHTMLString)
                } else {
                  newString = rewriter.rewriteHTML(outerHTMLString)
                }
                if (newString != null && newString !== outerHTMLString) {
                  return newString
                }
              }
              return outerHTMLString
            },
            function (htmlString) {
              if (!this._no_rewrite) {
                if (this.tagName === 'STYLE') {
                  htmlString = rewriter.rewriteStyle(htmlString)
                } else {
                  htmlString = rewriter.rewriteHTML(htmlString)
                }
              }

              return osetOUTERHTML.call(this, htmlString)
            }
          )
        }
      }

      if (window.HTMLIFrameElement && window.HTMLIFrameElement.prototype) {
        const osetSRCDOC = rewriter.getOSetter(
          window.HTMLIFrameElement.prototype,
          'srcdoc'
        )

        if (osetSRCDOC) {
          const ogetSRCDOC = rewriter.getOGetter(
            window.HTMLIFrameElement.prototype,
            'srcdoc'
          )
          rewriter.defineProperty2(
            window.HTMLIFrameElement.prototype,
            'srcdoc',
            function () {
              return ogetSRCDOC.call(this)
            },
            function (htmlString) {
              if (!this._no_rewrite) {
                if (this.tagName === 'STYLE') {
                  htmlString = rewriter.rewriteStyle(htmlString)
                } else {
                  htmlString = rewriter.rewriteHTML(htmlString)
                }
              }

              return osetSRCDOC.call(this, htmlString)
            }
          )
        }
      }

      if (window.HTMLStyleElement && window.HTMLStyleElement.prototype) {
        const osetTEXTCONTENT = rewriter.getOSetter(
          window.HTMLStyleElement.prototype,
          'textContent'
        )

        if (osetTEXTCONTENT) {
          const ogetTEXTCONTENT = rewriter.getOGetter(
            window.HTMLStyleElement.prototype,
            'textContent'
          )
          rewriter.defineProperty2(
            window.HTMLStyleElement.prototype,
            'textContent',
            function () {
              return ogetTEXTCONTENT.call(this)
            },
            function (htmlString) {
              if (!this._no_rewrite) {
                if (this.tagName === 'STYLE') {
                  htmlString = rewriter.rewriteStyle(htmlString)
                } else {
                  htmlString = rewriter.rewriteHTML(htmlString)
                }
              }

              return osetTEXTCONTENT.call(this, htmlString)
            }
          )
        }
      }

      if (window.SVGImageElement && window.SVGImageElement.prototype) {
        const oGetAttribute = window.SVGImageElement.prototype.getAttribute

        window.SVGImageElement.prototype.getAttribute = function getAttribute (
          name
        ) {
          let result = oGetAttribute.call(this, name)

          if (name === 'href') {
            result = rewriter.doRewrite(result)
          }

          return result
        }

        const oGetAttributeNS = window.SVGImageElement.prototype.getAttributeNS

        window.SVGImageElement.prototype.getAttributeNS = function getAttributeNS (
          namespaceURI,
          localName
        ) {
          let result = oGetAttributeNS.call(this, namespaceURI, localName)

          if (localName === 'href') {
            result = rewriter.doRewrite(result)
          }

          return result
        }

        const oSetAttribute = window.SVGImageElement.prototype.setAttribute

        window.SVGImageElement.prototype.setAttribute = function setAttribute (
          name,
          value
        ) {
          if (name.indexOf('xlink:href') >= 0 || name === 'href') {
            value = rewriter.doRewrite(value)
          }

          return oSetAttribute.call(this, name, value)
        }

        const oSetAttributeNS = window.SVGImageElement.prototype.setAttributeNS

        window.SVGImageElement.prototype.setAttributeNS = function setAttributeNS (
          namespaceURI,
          qualifiedName,
          value
        ) {
          if (qualifiedName === 'href') {
            value = rewriter.doRewrite(value)
          }

          return oSetAttributeNS.call(this, namespaceURI, qualifiedName, value)
        }
      }

      {
        const dwrite = window.document.write

        function nwrite (string) {
          const nb = rewriter.rewriteHTML(string, true)
          if (!nb) return
          return dwrite.call(this, nb)
        }

        window.document.write = nwrite
        window.Document.prototype.write = nwrite
        const dwriteln = window.document.writeln

        function nwriteln (string) {
          const nb = rewriter.rewriteHTML(string, true)
          if (!nb) return
          return dwriteln.call(this, nb)
        }

        window.document.writeln = nwriteln
        window.Document.prototype.writeln = nwriteln
      }

      let styleProto = window.CSSStyleDeclaration.prototype
      if (window.CSS2Properties) {
        styleProto = window.CSS2Properties.prototype
      }
      this.overrideStyleAttribute(styleProto, 'cssText')
      this.overrideStyleAttribute(styleProto, 'background', 'background')
      this.overrideStyleAttribute(
        styleProto,
        'backgroundImage',
        'background-image'
      )
      this.overrideStyleAttribute(styleProto, 'cursor', 'cursor')
      this.overrideStyleAttribute(styleProto, 'listStyle', 'list-style')
      this.overrideStyleAttribute(
        styleProto,
        'listStyleImage',
        'list-style-image'
      )
      this.overrideStyleAttribute(styleProto, 'border', 'border')
      this.overrideStyleAttribute(styleProto, 'borderImage', 'border-image')
      this.overrideStyleAttribute(
        styleProto,
        'borderImageSource',
        'border-image-source'
      )
      const oStyleSetProp = styleProto.setProperty
      styleProto.setProperty = function setProperty (name, value, priority) {
        value = rewriter.rewriteStyle(value)
        return oStyleSetProp.call(this, name, value, priority)
      }

      if (window.Audio) {
        class NewAudio extends window.Audio {
          constructor (src) {
            super(rewriter.doRewrite(src))
          }
        }

        window.Audio = NewAudio
      }

      if (window.ServiceWorkerContainer) {
        const oReg = window.ServiceWorkerContainer.prototype.register
        window.ServiceWorkerContainer.prototype.register = function register (
          scriptURL,
          options
        ) {
          scriptURL = rewriter.doRewrite(scriptURL, 'js_')
          if (options && options.scope) {
            options.scope = rewriter.doRewrite(options.scope)
          }
          return oReg.call(this, scriptURL, options)
        }
      }

      if (window.navigator.sendBeacon) {
        const osendBecon = window.navigator.sendBeacon
        window.navigator.sendBeacon = function sendBeacon (url, data) {
          return osendBecon.call(this, rewriter.doRewrite(url), data)
        }
      }
      {
        const oPushState = window.history.pushState

        function pushState (state_obj, title, url) {
          let rewritten_url
          if (url) {
            rewritten_url = rewriter.doRewrite(url)
          } else {
            rewritten_url = window.location.href
          }
          oPushState.call(this, state_obj, title, rewritten_url)
        }

        window.history.pushState = pushState
        const oReplaceState = window.history.replaceState

        function replaceState (state_obj, title, url) {
          let rewritten_url
          if (url) {
            let parser = window.document.createElement('a')
            parser.href = url
            url = parser.href
            rewritten_url = rewriter.doRewrite(url)
          } else {
            rewritten_url = window.location.href
          }
          oReplaceState.call(this, state_obj, title, rewritten_url)
        }

        window.history.replaceState = replaceState
        if (window.History && window.History.prototype) {
          window.History.prototype.pushState = pushState
          window.History.prototype.replaceState = replaceState
        }
      }

      if (window.EventSource) {
        class NEventSource extends window.EventSource {
          constructor (url, init) {
            super(rewriter.doRewrite(url), init)
          }
        }

        window.EventSource = NEventSource
      }

      if (window.WebSocket) {
        class NWebSocket extends window.WebSocket {
          constructor (url, protocols) {
            super(rewriter.doRewrite(url), protocols)
          }
        }

        window.WebSocket = NWebSocket
      }

      if (window.Worker) {
        function workerInterceptor (url) {
          if (url.indexOf('blob:') === 0) {
            return url
          }
          return rewriter.doRewrite(url, 'js_')
        }

        class NWorker extends window.Worker {
          constructor (url) {
            super(workerInterceptor(url))
          }
        }

        window.Worker = NWorker
      }

      if (window.SharedWorker) {
        function sharedWorkerInterceptor (url) {
          if (url.indexOf('blob:') === 0) {
            return url
          }
          return rewriter.doRewrite(url, 'js_')
        }

        class NSharedWorker extends window.SharedWorker {
          constructor (url) {
            super(sharedWorkerInterceptor(url))
          }
        }

        window.SharedWorker = NSharedWorker
      }
    }

    overrideStyleAttribute (obj, attr, prop_name) {
      let ogetter = this.getOGetter(obj, attr)
      const osetter = this.getOSetter(obj, attr)
      const rewriter = this
      const setter = function (orig) {
        let val = rewriter.rewriteStyle(orig)
        if (osetter) {
          osetter.call(this, val)
        } else {
          this.setProperty(prop_name, val)
        }
        return val
      }
      let getter = ogetter
      if (!getter) {
        getter = function () {
          return this.getPropertyValue(prop_name)
        }
      }
      if ((osetter && ogetter) || prop_name) {
        this.defineProperty(obj, attr, setter, getter)
      }
    }

    overrideHist (func_name) {
      const rewriter = this
      const ofunc = window.history[func_name]
      if (!ofunc) return
      window.history['_orig_' + func_name] = ofunc

      function rewriteIt (state_obj, title, url) {
        let rewritten_url
        if (url) {
          let parser = window.document.createElement('a')
          parser.href = url
          url = parser.href
          rewritten_url = rewriter.doRewrite(url)
        } else {
          rewritten_url = window.location.href
        }
        ofunc.call(this, state_obj, title, rewritten_url)
      }

      window.history[func_name] = rewriteIt
      if (window.History && window.History.prototype) {
        window.History.prototype[func_name] = rewriteIt
      }
    }

    getOGetter (obj, prop) {
      let orig_getter
      if (obj.__lookupGetter__) {
        orig_getter = obj.__lookupGetter__(prop)
      }
      if (!orig_getter && Object.getOwnPropertyDescriptor) {
        let props = Object.getOwnPropertyDescriptor(obj, prop)
        if (props) {
          orig_getter = props.get
        }
      }
      return orig_getter
    }

    getOSetter (obj, prop) {
      let orig_setter
      if (obj.__lookupSetter__) {
        orig_setter = obj.__lookupSetter__(prop)
      }
      if (!orig_setter && Object.getOwnPropertyDescriptor) {
        let props = Object.getOwnPropertyDescriptor(obj, prop)
        if (props) {
          orig_setter = props.set
        }
      }
      return orig_setter
    }

    shouldRewriteAttribute (tagName, attribute) {
      if (attribute === 'href' || attribute === 'src') return true
      if (tagName === 'VIDEO' && attribute === 'poster') return true
      return tagName === 'META' && attribute === 'content'
    }

    rewriteInlineStyle (orig) {
      let decoded
      let val
      try {
        decoded = decodeURIComponent(orig)
      } catch (e) {
        decoded = orig
      }
      if (decoded !== orig) {
        val = this.rewriteStyle(decoded)
        let parts = val.split(',', 2)
        val = parts[0] + ',' + encodeURIComponent(parts[1])
      } else {
        val = this.rewriteStyle(orig)
      }
      return val
    }

    rewriteStyle (style) {
      if (!style) return style
      const styleType = typeof style
      if (styleType === 'object') {
        style = style.toString().replace(this.STYLE_REGEX, this.replaceStyle)
        style = style.replace(this.IMPORT_REGEX, this.replaceStyle)
      } else if (styleType === 'string') {
        style = style.replace(this.STYLE_REGEX, this.replaceStyle)
        style = style.replace(this.IMPORT_REGEX, this.replaceStyle)
      }
      return style
    }

    replaceStyle (match, n1, n2, n3, offset, string) {
      return n1 + this.doRewrite(n2, 'im_') + n3
    }

    isFullHTML (htmlString) {
      let itIs = htmlString.indexOf('<html') === 0
      if (itIs) return itIs
      itIs = htmlString.indexOf('<head') === 0
      if (itIs) return itIs
      return htmlString.indexOf('<body') === 0
    }

    rewriteFullHTML (string, needsEnd) {
      let inner_doc = new DOMParser().parseFromString(string, 'text/html')
      if (!inner_doc) return string
      let changed = false
      let i = 0
      let len = inner_doc.all.length
      while (i < len) {
        changed = this.rewriteElement(inner_doc.all[i]) || changed
        i++
      }
      if (changed) {
        let new_html
        // if original had <html> tag, add full document HTML
        if (string && string.indexOf('<html') >= 0) {
          inner_doc.documentElement._no_rewrite = true
          new_html = inner_doc.documentElement.outerHTML
        } else {
          // otherwise, just add contents of head and body
          inner_doc.head._no_rewrite = true
          inner_doc.body._no_rewrite = true
          new_html = inner_doc.head.innerHTML
          new_html += inner_doc.body.innerHTML
          if (needsEnd) {
            if (inner_doc.all.length > 3) {
              let end_tag = '</' + inner_doc.all[3].tagName.toLowerCase() + '>'
              if (
                this.endsWith(new_html, end_tag) &&
                !this.endsWith(string, end_tag)
              ) {
                new_html = new_html.substring(
                  0,
                  new_html.length - end_tag.length
                )
              }
            } else if (string[0] !== '<' || string[string.length - 1] !== '>') {
              this.write_buff += string
              return
            }
          }
        }
        return new_html
      }
      return string
    }

    endsWith (test, suffix) {
      if (test.indexOf(suffix, test.length - suffix.length) !== -1) {
        return suffix
      } else {
        return undefined
      }
    }

    rewriteHTML (string, needsEnd) {
      if (!string) return string
      if (typeof string !== 'string') string = string.toString()
      if (this.write_buff) {
        string = this.write_buff + string
        this.write_buff = ''
      }
      if (!window.HTMLTemplateElement || this.isFullHTML(string)) {
        return this.rewriteFullHTML(string, needsEnd)
      }
      let inner_doc = new DOMParser().parseFromString(
        `<template>${string}</template>`,
        'text/html'
      )
      if (
        !inner_doc ||
        !inner_doc.head ||
        !inner_doc.head.children ||
        !inner_doc.head.children[0].content
      ) {
        return string
      }
      let template = inner_doc.head.children[0]
      if (this.rewriteElementRecursive(template.content)) {
        template._no_rewrite = true
        let new_html = template.innerHTML
        if (needsEnd) {
          let first_elem =
            template.content.children && template.content.children[0]
          if (first_elem) {
            let end_tag = '</' + first_elem.tagName.toLowerCase() + '>'
            if (
              this.endsWith(new_html, end_tag) &&
              !this.endsWith(string, end_tag)
            ) {
              new_html = new_html.substring(0, new_html.length - end_tag.length)
            }
          } else if (string[0] !== '<' || string[string.length - 1] !== '>') {
            this.write_buff += string
            console.log('setting write buffer')
            return
          }
        }
        return new_html
      }
      return string
    }

    rewriteElementRecursive (elem) {
      let changed = false
      if (elem) {
        let children = elem.children || elem.childNodes
        if (children) {
          for (let i = 0; i < children.length; ++i) {
            if (children[i].nodeType === Node.ELEMENT_NODE) {
              changed = this.rewriteElement(children[i]) || changed
              changed = this.rewriteElementRecursive(children[i]) || changed
            } else {
              console.log('rewriteElementRecursive not considered', children[i])
            }
          }
        }
      }
      return changed
    }

    rewriteElement (elem) {
      let changed = false
      if (!elem) return changed
      if (elem._no_rewrite) return
      const lowerName = elem.tagName.toLowerCase()
      if (lowerName === 'style') {
        const rewrittenContent = this.rewriteStyle(elem.textContent)
        if (elem.textContent !== rewrittenContent) {
          elem.textContent = rewrittenContent
          changed = true
        }
      } else if (this.tagToModGs[lowerName]) {
        const toCheck = this.tagToModGs[lowerName]
        for (const [propName, { getter, setter }] of Object.entries(toCheck)) {
          if (getter) {
            let oldV = getter.call(elem)
            if (oldV) {
              let newV
              if (propName === 'srcset') {
                newV = this.rewriteSrcset(oldV)
              } else {
                let maybeMod = this.tagToMod[lowerName]
                newV = this.doRewrite(
                  oldV,
                  maybeMod ? maybeMod[propName] : maybeMod
                )
              }
              if (newV !== oldV) {
                if (setter) {
                  setter.call(elem, newV)
                } else {
                  this.myCopySetAt.call(elem, propName, newV)
                }
                changed = true
              }
            }
          } else {
            let oldV = this.myCopyGetAt.call(elem, propName)
            if (oldV) {
              let newV
              if (propName === 'srcset') {
                newV = this.rewriteSrcset(oldV)
              } else {
                let maybeMod = this.tagToMod[lowerName]
                newV = this.doRewrite(
                  oldV,
                  maybeMod ? maybeMod[propName] : maybeMod
                )
              }
              if (newV !== oldV) {
                if (setter) {
                  setter.call(elem, newV)
                } else {
                  this.myCopySetAt.call(elem, propName, newV)
                }
                changed = true
              }
            }
          }
        }
      } else {
        let maybeIt = this.myCopyGetAt.call(elem, 'src')
        if (maybeIt) {
          let newv = this.doRewrite(maybeIt)
          if (maybeIt !== newv) {
            this.myCopySetAt.call(elem, 'src', newv)
            changed = true
          }
        } else {
          maybeIt = this.myCopyGetAt.call(elem, 'href')
          if (maybeIt) {
            let newv = this.doRewrite(maybeIt)
            if (maybeIt !== newv) {
              this.myCopySetAt.call(elem, 'href', newv)
              changed = true
            }
          }
        }
      }

      let maybeStyle = this.myCopyGetAt.call(elem, 'style')
      if (maybeStyle) {
        let newStyle = this.rewriteStyle(maybeStyle)
        if (newStyle !== maybeStyle) {
          this.myCopySetAt.call(elem, 'style', newStyle)
          changed = true
        }
      }
      if (this.myCopyGetAt.call(elem, 'crossorigin')) {
        elem.removeAttribute('crossorigin')
        changed = true
      }
      if (this.myCopyGetAt.call(elem, 'integrity')) {
        elem.removeAttribute('integrity')
        changed = true
      }
      return changed
    }

    rewriteSrcset (srcset) {
      if (!srcset) return ''
      let values = srcset
        .split(/\s*(\S*\s+[\d.]+[wx]),|(?:\s*,(?:\s+|(?=https?:)))/)
        .filter(Boolean)
      let i = 0
      let len = values.length
      while (i < len) {
        values[i] = this.doRewrite(values[i].trim())
        i++
      }
      return values.join(', ')
    }
  }

  GenericIARewritter.init()
}

window.eval(`(${inject.toString()})();`)
