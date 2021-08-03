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
    // ref : textarea, menuRef : menu
    // textarea : 멘션되는 input 박스, menu : 자동완성 태그 집합
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

    // 필터링 된 유저 판별
    async makeOptions(query) {
        // 필터링 비동기 처리
        const options = await this.resolveFn(query)
        // 필터링된 유저가 한명이라도 있는 경우
        if (options.length !== 0) {
            this.options = options
            // 메뉴출력
            this.renderMenu()
        } else {
            // 메뉴 닫기
            this.closeMenu()
        }
    }

    // 호출되자마자 바로 메뉴를 닫음
    closeMenu() {
        setTimeout(() => {
            this.options = []
            this.left = undefined
            this.top = undefined
            this.triggerIdx = undefined
            // 메뉴를 다시 그림
            this.renderMenu()
        }, 0)
    }

    // 메뉴가 열려있는 상태에서 tab키 입력시 or 메뉴 랜더링 시 호출됨
    // 아이템을 선택해주는 함수(메뉴 닫음)
    selectItem(active) {
        return () => {
            // 아이템 선택 시 인덱스를 계산하여 선택된 아이템으로 완성시켜 줌
            const preMention = this.ref.value.substr(0, this.triggerIdx)
            const option = this.options[active]
            const mention = this.replaceFn(option, this.ref.value[this.triggerIdx])
            const postMention = this.ref.value.substr(this.ref.selectionStart)
            const newValue = `${preMention}${mention}${postMention}`
            this.ref.value = newValue
            const caretPosition = this.ref.value.length - postMention.length
            // textarea에서 현재 텍스트 선택의 시작(caretPosition) 및 끝(caretPosition) 위치를 설정
            this.ref.setSelectionRange(caretPosition, caretPosition)
            this.closeMenu()
            this.ref.focus()
        }
    }

    // 입력 발생 시 호출되는 함수(textarea에 키 입력 시)
    onInput(ev) {
        // 시작위치 설정
        const positionIndex = this.ref.selectionStart
        const textBeforeCaret = this.ref.value.slice(0, positionIndex) 
        // 공백(space bar)로 토큰 구별
        const tokens = textBeforeCaret.split(/\s/) // \s = space bar https://hamait.tistory.com/342
        // 토큰의 마지막 인덱스
        const lastToken = tokens[tokens.length - 1]
        // 전체 textarea에서 trigger(@) 지점을 찾아서 그때그때마다 메뉴 출력
        const triggerIdx = textBeforeCaret.endsWith(lastToken)
            ? textBeforeCaret.length - lastToken.length
            : -1
        const maybeTrigger = textBeforeCaret[triggerIdx] 
        const keystrokeTriggered = maybeTrigger === '@'
        // const maybeTrigger = textBeforeCaret[triggerIdx] == ' ' 
        // const keystrokeTriggered = maybeTrigger === ' '

        // trigger(@)가 아닐경우엔 메뉴 출력 x
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

    // 키보드 이벤트 처리 함수
    onKeyDown(ev) {
        let keyCaught = false
        // trigger(@)가 있는 경우에만 = 메뉴창이 열렸을 때만
        if (this.triggerIdx !== undefined) {
            switch (ev.key) {
                // 키보드 윗방향키
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

        // 위의 키보드 이벤트 발생 시 창이 새로고침 되는 것을 막기 위한 처리
        if (keyCaught) {
            ev.preventDefault()
        }
    }

    // 메뉴를 최신화해서 보여주는 함수
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

// 공백일 경우 user 전체를, 아닐 경우 시작한 문자에 해당하는 유저만 필터링해줌
const resolveFn = prefix => prefix === ''
    ? users
    : users.filter(user => user.username.startsWith(prefix))

// trigger(현재는 @)과 username을 합쳐서 만들어줌(자동완성)
const replaceFn = (user, trigger) => `${trigger}${user.username} `

//
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