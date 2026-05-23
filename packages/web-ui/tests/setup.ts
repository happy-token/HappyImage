import { Window, GlobalWindow } from 'happy-dom'

const window = new GlobalWindow()
// @ts-ignore
globalThis.document = window.document
// @ts-ignore
globalThis.window = window
// @ts-ignore
globalThis.HTMLElement = window.HTMLElement
// @ts-ignore
globalThis.customElements = window.customElements
// @ts-ignore
globalThis.DOMParser = window.DOMParser
// @ts-ignore
globalThis.Node = window.Node
// @ts-ignore
globalThis.Event = window.Event
// @ts-ignore
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
