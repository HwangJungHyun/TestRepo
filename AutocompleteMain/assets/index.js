const properties = [
    'direction',
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',

    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderStyle',

    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',

    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',

    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',

    'letterSpacing',
    'wordSpacing',

    'tabSize',
    'MozTabSize',
]

const isFirefox = typeof window !== 'undefined' && window['mozInnerScreenX'] != null

// JavaScript는 type이 불명확하므로 @param을 통해 파라미터에 대한 설명을 명시
/**
 * @param {HTMLTextAreaElement} element
 * @param {number} position
 */
function getCaretCoordinates(element, position) {
    // div의 HTML 요소를 반환 
    const div = document.createElement('div')
    // 문서에 있는 바디 요소의 끝에 div를 붙임 (<body><div></div></body>)
    document.body.appendChild(div)

    const style = div.style
    // element의 모든 CSS 속성값을 담은 객체를 회신
    const computed = getComputedStyle(element)

    // 연속 공백 유지. 한 줄이 너무 길어서 넘칠 경우 자동으로 줄을 바꿈
    style.whiteSpace = 'pre-wrap'
    // 단어 넘침 X
    style.wordWrap = 'break-word'
    // 절대위치. 위치 고정
    style.position = 'absolute'
    style.visibility = 'hidden'

    // forEach는 map과는 달리 리턴값 X. 단순 순회
    properties.forEach(prop => {
        style[prop] = computed[prop]
    })

    // Firefox 브라우저가 아닌 경우
    if (!isFirefox) {
        if (element.scrollHeight > parseInt(computed.height))
            console.log(parseInt(computed.height));
    } else {
        style.overflow = 'hidden'
    }

    // 0부터 position 전까지의 부분 문자열을 반환
    div.textContent = element.value.substring(0, position)

    const span = document.createElement('span')
    span.textContent = element.value.substring(position) || '.'
    div.appendChild(span)

    const coordinates = {
        top: span.offsetTop + parseInt(computed['borderTopWidth']),
        left: span.offsetLeft + parseInt(computed['borderLeftWidth']),
        // height: parseInt(computed['lineHeight'])
        height: span.offsetHeight
    }

    div.remove()

    return coordinates
}

// new Mentionify(
//     document.getElementById('textarea'),
//     document.getElementById('menu'),
//     resolveFn,
//     replaceFn,
//     menuItemFn
// )

class Mentionify {
    // 비동기 처리로 인한 정상적인 값 출력을 위한 인자 값 bind()
    constructor(ref, menuRef, resolveFn, replaceFn, menuItemFn) {
        this.ref = ref
        this.menuRef = menuRef
        this.resolveFn = resolveFn
        this.replaceFn = replaceFn
        this.menuItemFn = menuItemFn
        this.options = []

        this.makeOptions = this.makeOptions.bind(this)
        this.closeMenu = this.closeMenu.bind(this)
        this.selectItem = this.selectItem.bind(this)
        this.onInput = this.onInput.bind(this)
        this.onKeyDown = this.onKeyDown.bind(this)
        this.renderMenu = this.renderMenu.bind(this)

        // input 이벤트 발생 시 onInput 함수 실행
        this.ref.addEventListener('input', this.onInput)
        // keydown 이벤트 발생 시 onKeyDown 함수 실행
        this.ref.addEventListener('keydown', this.onKeyDown)
    }

    // 비동기로 처리
    async makeOptions(query) {
        const options = await this.resolveFn(query)
        if (options.lenght !== 0) {
            this.options = options
            this.renderMenu()
        } else {
            this.closeMenu()
        }
    }

    closeMenu() {
        setTimeout(() => {
            this.options = []
            this.left = undefined
            this.top = undefined
            this.triggerIdx = undefined
            this.renderMenu()
        }, 0)
    }

    selectItem(active) {
        return () => {
            const preMention = this.ref.value.substr(0, this.triggerIdx)
            const option = this.options[active]
            const mention = this.replaceFn(option, this.ref.value[this.triggerIdx])
            const postMention = this.ref.value.substr(this.ref.selectionStart)
            const newValue = `${preMention}${mention}${postMention}`
            this.ref.value = newValue
            const caretPosition = this.ref.value.length - postMention.length
            this.ref.setSelectionRange(caretPosition, caretPosition)
            this.closeMenu()
            this.ref.focus()
        }
    }

    onInput(ev) {
        const positionIndex = this.ref.selectionStart
        const textBeforeCaret = this.ref.value.slice(0, positionIndex)
        const tokens = textBeforeCaret.split(/\s/) // \s = space bar https://hamait.tistory.com/342
        const lastToken = tokens[tokens.length - 1]
        const triggerIdx = textBeforeCaret.endsWith(lastToken)
            ? textBeforeCaret.length - lastToken.length
            : -1
        const maybeTrigger = textBeforeCaret[triggerIdx] 
        const keystrokeTriggered = maybeTrigger === '@'
        // const maybeTrigger = textBeforeCaret[triggerIdx] == ' ' 
        // const keystrokeTriggered = maybeTrigger === ' '

        if (!keystrokeTriggered) {
            this.closeMenu()
            return
        }

        const query = textBeforeCaret.slice(triggerIdx + 1)
        this.makeOptions(query)

        const coords = getCaretCoordinates(this.ref, positionIndex)
        const { top, left } = this.ref.getBoundingClientRect()

        setTimeout(() => {
            this.active = 0
            this.left = window.scrollX + coords.left + left + this.ref.scrollLeft
            this.top = window.scrollY + coords.top + top + coords.height - this.ref.scrollTop
            this.triggerIdx = triggerIdx
            this.renderMenu()
        }, 0)
    }

    onKeyDown(ev) {
        let keyCaught = false
        if (this.triggerIdx !== undefined) {
            switch (ev.key) {
                case 'ArrowDown':
                    this.active = Math.min(this.active + 1, this.options.length - 1)
                    this.renderMenu()
                    keyCaught = true
                    break
                case 'ArrowUp':
                    this.active = Math.max(this.active - 1, 0)
                    this.renderMenu()
                    keyCaught = true
                    break
                case 'Enter':
                case 'Tab':
                    this.selectItem(this.active)()
                    keyCaught = true
                    break
            }
        }

        if (keyCaught) {
            ev.preventDefault()
        }
    }

    renderMenu() {
        if (this.top === undefined) {
            this.menuRef.hidden = true
            return
        }

        this.menuRef.style.left = this.left + 'px'
        this.menuRef.style.top = this.top + 'px'
        this.menuRef.innerHTML = ''

        this.options.forEach((option, idx) => {
            this.menuRef.appendChild(this.menuItemFn(
                option,
                this.selectItem(idx),
                this.active === idx))
        })

        this.menuRef.hidden = false
    }
}

const users = [
   { username: 'aaaaa' },
   { username: 'aaa2' },
   { username: 'aaa3' },
   { username: 'aaa4' },
   { username: 'bb2' },
   { username: 'bb3' },
   { username: 'bb4' },
   { username: 'bb5' },
   { username: 'cc1' },
   { username: 'iccccccc2' },
   { username: 'ccccccc3' },
   { username: 'c4444444444' },
   { username: 'c555555555' },
   { username: 'c6666666666666' },
   { username: 'dddddddddddd' }
]


const resolveFn = prefix => prefix === ''
    ? users
    : users.filter(user => user.username.startsWith(prefix))

const replaceFn = (user, trigger) => `${trigger}${user.username} `

const menuItemFn = (user, setItem, selected) => {
    const div = document.createElement('div')
    div.setAttribute('role', 'option')
    div.className = 'menu-item'
    if (selected) {
        div.classList.add('selected')
        div.setAttribute('aria-selected', '')
    }
    div.textContent = user.username
    div.onclick = setItem
    return div
}

new Mentionify(
    document.getElementById('textarea'),
    document.getElementById('menu'),
    resolveFn,
    replaceFn,
    menuItemFn
)