/**
 * Tables.vue 球桌预约页面联动测试
 *
 * 覆盖：
 * - 初始挂载即按 类型+日期 请求列表
 * - 快速连续切换日期：只有最后一次响应生效，旧响应不覆盖
 * - 列表加载中点击“立即预约”不打开弹窗
 * - 弹窗时段随 (球桌, 日期) 请求；日期切换后旧时段响应作废
 * - 确认预约期间重复点击只提交一次，结果取同一次响应
 * - 组件卸载后在途响应不写状态
 * - 再次预约 query（tableId/date）回来后自动打开对应球桌
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

// 用可控的 deferred 接口模拟 api，精确控制响应返回时机
const mocks = vi.hoisted(() => ({
  getTables: vi.fn(),
  getTableSlots: vi.fn(),
  bookTable: vi.fn()
}))

vi.mock('../utils/api', () => ({
  default: {
    getTables: mocks.getTables,
    getTableSlots: mocks.getTableSlots,
    bookTable: mocks.bookTable
  },
  TABLE_META: [
    { id: 1, typeId: 'snooker' },
    { id: 2, typeId: 'snooker' },
    { id: 3, typeId: 'pool' },
    { id: 4, typeId: 'pool' },
    { id: 5, typeId: 'chinese' },
    { id: 6, typeId: 'chinese' }
  ]
}))

vi.mock('../utils/auth', () => ({
  isAuthenticated: () => true
}))

import Tables from '../views/Tables.vue'

const FUTURE_DATE = '2027-06-15'
const FUTURE_DATE_2 = '2027-06-16'

const TABLES = [
  { id: 1, name: '1号球桌', type: '斯诺克', typeId: 'snooker', price: 80, available: true, size: '12尺', brand: '星牌' },
  { id: 3, name: '3号球桌', type: '美式九球', typeId: 'pool', price: 60, available: true, size: '9尺', brand: 'Brunswick' }
]

const OPEN_SLOTS = [
  { id: 1, time: '10:00 - 12:00', available: true },
  { id: 2, time: '12:00 - 14:00', available: false }
]

function defer() {
  let resolve
  const promise = new Promise(r => {
    resolve = r
  })
  return { promise, resolve }
}

function mountTable(query = {}) {
  return mount(Tables, {
    global: {
      mocks: {
        $route: { query }
      },
      stubs: {
        Modal: {
          props: ['modelValue', 'loading', 'confirmDisabled'],
          emits: ['update:modelValue', 'confirm'],
          template: '<div v-if="modelValue" class="stub-modal"><slot /><button class="stub-confirm" @click="$emit(\'confirm\')">ok</button></div>'
        },
        Toast: { template: '<div />' },
        LoginModal: { template: '<div />' }
      }
    }
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getTables.mockResolvedValue({ success: true, data: TABLES })
  mocks.getTableSlots.mockResolvedValue({ success: true, data: OPEN_SLOTS })
  mocks.bookTable.mockResolvedValue({
    success: true,
    data: {
      orderNo: 'BK12345678',
      tableId: 1,
      tableName: '1号球桌',
      type: '斯诺克',
      date: FUTURE_DATE,
      time: '10:00 - 12:00',
      slotId: 1,
      duration: 2,
      price: 80,
      amount: 160,
      status: 'pending_payment'
    }
  })
})

describe('Tables 页面列表请求联动', () => {
  it('挂载时按当前类型与日期请求一次列表', async () => {
    const wrapper = mountTable()
    await flushPromises()
    expect(mocks.getTables).toHaveBeenCalledTimes(1)
    expect(mocks.getTables).toHaveBeenCalledWith({
      type: 'all',
      date: wrapper.vm.selectedDate
    })
    expect(wrapper.vm.tables).toEqual(TABLES)
  })

  it('快速连续切换日期时，先返回的旧响应被丢弃，只采用最后一次', async () => {
    const initial = defer()
    const day1 = defer()
    const day2 = defer()
    mocks.getTables
      .mockImplementationOnce(() => initial.promise)
      .mockImplementationOnce(() => day1.promise)
      .mockImplementationOnce(() => day2.promise)

    const wrapper = mountTable()
    await nextTick()

    // 连续切两次日期，连同初始请求共三个在途请求
    wrapper.vm.selectedDate = FUTURE_DATE
    await nextTick()
    wrapper.vm.selectedDate = FUTURE_DATE_2
    await nextTick()
    expect(mocks.getTables).toHaveBeenCalledTimes(3)

    const staleData = TABLES.map(t => ({ ...t, available: false }))
    day1.resolve({ success: true, data: staleData })
    await flushPromises()
    // 旧响应已返回，但不能落库（初始请求未完成，列表仍为空）
    expect(wrapper.vm.tables).toEqual([])

    const freshData = TABLES.map(t => ({ ...t, available: true }))
    day2.resolve({ success: true, data: freshData })
    await flushPromises()
    expect(wrapper.vm.tables).toEqual(freshData)

    // 最晚的初始响应此时才回来，也必须被丢弃
    initial.resolve({ success: true, data: staleData })
    await flushPromises()
    expect(wrapper.vm.tables).toEqual(freshData)
  })

  it('列表加载中点击“立即预约”不会打开弹窗', async () => {
    const pending = defer()
    mocks.getTables.mockImplementationOnce(() => pending.promise)
    const wrapper = mountTable()
    await nextTick()

    // 初始请求尚未返回，直接尝试用已知球桌数据打开
    wrapper.vm.openBooking(TABLES[0])
    expect(wrapper.vm.showBookingModal).toBe(false)
    expect(mocks.getTableSlots).not.toHaveBeenCalled()

    pending.resolve({ success: true, data: TABLES })
    await flushPromises()
    wrapper.vm.openBooking(wrapper.vm.tables[0])
    expect(wrapper.vm.showBookingModal).toBe(true)
  })
})

describe('Tables 预约弹窗联动', () => {
  async function openModal(wrapper) {
    await flushPromises()
    wrapper.vm.openBooking(wrapper.vm.tables[0])
    await flushPromises()
    expect(wrapper.vm.showBookingModal).toBe(true)
  }

  it('打开弹窗时球桌为快照，列表刷新后弹窗内球桌不被替换', async () => {
    const wrapper = mountTable()
    await openModal(wrapper)

    expect(wrapper.vm.selectedTable).not.toBe(wrapper.vm.tables[0])
    expect(wrapper.vm.selectedTable.id).toBe(1)

    // 列表数据整体换成另一份（模拟刷新），弹窗快照保持不变
    wrapper.vm.tables = TABLES.map(t => ({ ...t, price: 999, name: '被刷新的球桌' }))
    expect(wrapper.vm.selectedTable.price).toBe(80)
    expect(wrapper.vm.selectedTable.name).toBe('1号球桌')
  })

  it('弹窗内切换日期会重新请求时段，旧日期的时段响应作废', async () => {
    const wrapper = mountTable()
    await flushPromises()

    const oldSlots = defer()
    const newSlots = defer()
    mocks.getTableSlots
      .mockImplementationOnce(() => oldSlots.promise)
      .mockImplementationOnce(() => newSlots.promise)

    wrapper.vm.openBooking(wrapper.vm.tables[0])
    await nextTick()

    wrapper.vm.bookingDate = FUTURE_DATE
    await nextTick()
    expect(mocks.getTableSlots).toHaveBeenCalledTimes(2)

    oldSlots.resolve({
      success: true,
      data: [{ id: 5, time: '18:00 - 20:00', available: true }]
    })
    await flushPromises()
    // 旧响应不能出现
    expect(wrapper.vm.timeSlots).toEqual([])

    newSlots.resolve({
      success: true,
      data: [{ id: 2, time: '12:00 - 14:00', available: true }]
    })
    await flushPromises()
    expect(wrapper.vm.timeSlots[0].id).toBe(2)
    // 默认选中的必须来自新响应的可用时段
    expect(wrapper.vm.selectedTimeSlot).toBe(2)
  })

  it('当前选中时段在新数据中不可用时自动回退到可用时段', async () => {
    const wrapper = mountTable()
    await openModal(wrapper)
    expect(wrapper.vm.selectedTimeSlot).toBe(1)

    mocks.getTableSlots.mockImplementationOnce(() =>
      Promise.resolve({
        success: true,
        data: [
          { id: 1, time: '10:00 - 12:00', available: false },
          { id: 2, time: '12:00 - 14:00', available: true }
        ]
      })
    )
    wrapper.vm.bookingDate = FUTURE_DATE
    await flushPromises()
    expect(wrapper.vm.selectedTimeSlot).toBe(2)
  })

  it('所有时段都不可约时确认按钮不可用', async () => {
    mocks.getTableSlots.mockResolvedValueOnce({
      success: true,
      data: [{ id: 1, time: '10:00 - 12:00', available: false }]
    })
    const wrapper = mountTable()
    await openModal(wrapper)
    await flushPromises()
    expect(wrapper.vm.selectedTimeSlot).toBeNull()
    expect(wrapper.vm.canConfirmBooking).toBe(false)
  })

  it('确认预约期间重复点击只提交一次，成功结果来自同一次响应', async () => {
    const wrapper = mountTable()
    await openModal(wrapper)

    const p1 = wrapper.vm.confirmBooking()
    // 在途时再次调用：重入保护直接拒绝
    const p2 = wrapper.vm.confirmBooking()
    await Promise.all([p1, p2])

    expect(mocks.bookTable).toHaveBeenCalledTimes(1)
    const payload = mocks.bookTable.mock.calls[0][0]
    expect(payload).toMatchObject({
      tableId: 1,
      slotId: 1,
      timeSlot: '10:00 - 12:00',
      duration: 2
    })
    expect(wrapper.vm.bookingResult).toMatchObject({
      orderNo: 'BK12345678',
      tableName: '1号球桌',
      date: FUTURE_DATE,
      time: '10:00 - 12:00'
    })
    expect(wrapper.vm.showSuccessModal).toBe(true)
    expect(wrapper.vm.showBookingModal).toBe(false)
  })

  it('下单失败后弹窗保留并重新拉取时段，不写成功结果', async () => {
    mocks.bookTable.mockResolvedValueOnce({
      success: false,
      error: '该时段已被预约或暂不可用，请选择其他时段'
    })
    const wrapper = mountTable()
    await openModal(wrapper)

    await wrapper.vm.confirmBooking()
    expect(wrapper.vm.showBookingModal).toBe(true)
    expect(wrapper.vm.showSuccessModal).toBe(false)
    expect(wrapper.vm.bookingResult).toBeNull()
    // 失败后重新拉了一次时段
    expect(mocks.getTableSlots.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('组件卸载后在途的列表/时段响应不再写入状态', async () => {
    const tablesPending = defer()
    mocks.getTables.mockImplementationOnce(() => tablesPending.promise)
    const wrapper = mountTable()
    wrapper.unmount()
    tablesPending.resolve({ success: true, data: TABLES })
    await flushPromises()
    // 在途响应未把 loading 复位（因组件已卸载、响应被作废）
    expect(wrapper.vm.isLoadingTables).toBe(true)
  })

  it('带 tableId/date/slotId 的“再次预约”query 回来后自动打开并预选原时段', async () => {
    const wrapper = mountTable({ tableId: '3', date: FUTURE_DATE, slotId: '2' })
    await flushPromises()

    expect(wrapper.vm.selectedDate).toBe(FUTURE_DATE)
    expect(wrapper.vm.bookingDate).toBe(FUTURE_DATE)
    expect(wrapper.vm.showBookingModal).toBe(true)
    expect(wrapper.vm.selectedTable.id).toBe(3)
    expect(mocks.getTableSlots).toHaveBeenCalledWith({ tableId: 3, date: FUTURE_DATE })
    // slot 2 在 OPEN_SLOTS 中不可约 -> 自动回退到可用的 slot 1，不保留过期选择
    expect(wrapper.vm.selectedTimeSlot).toBe(1)
  })
})
