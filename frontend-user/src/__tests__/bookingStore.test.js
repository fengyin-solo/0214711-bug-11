/**
 * bookingStore 联动一致性测试
 *
 * 覆盖：
 * - 快速连续切换日期：同一次查询的表/时段始终对应同一日期
 * - 预约快照：提交后修改入参不影响落库记录（防串位）
 * - 球桌、日期、时段、价格、任务数据同源
 * - 取消后记录保留且占用释放（可再次预约）
 * - 并发占用校验
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { bookingStore } from '../utils/bookingStore'
import { taskStore } from '../utils/taskStore'

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

describe('bookingStore 球桌与时段查询', () => {
  it('每次返回的球桌都带有请求日期与该日期的时段', async () => {
    const result = await bookingStore.fetchTables('2027-05-01')
    expect(result.date).toBe('2027-05-01')
    expect(result.tables).toHaveLength(6)
    result.tables.forEach(table => {
      expect(table.date).toBe('2027-05-01')
      expect(table.slots).toHaveLength(6)
      table.slots.forEach(slot => {
        expect(slot).toHaveProperty('available')
        expect(slot).toHaveProperty('time')
      })
    })
  })

  it('快速连续切换日期时，各响应只对应各自的日期，不会互相污染', async () => {
    const [r1, r2, r3] = await Promise.all([
      bookingStore.fetchTables('2027-05-01'),
      bookingStore.fetchTables('2027-05-02'),
      bookingStore.fetchTables('2027-05-03')
    ])
    // 调用方用 requestId 去重；每个响应自身的日期/数据必须自洽
    expect(r1.requestId).not.toBe(r2.requestId)
    expect(r2.requestId).not.toBe(r3.requestId)
    expect(r1.date).toBe('2027-05-01')
    expect(r2.date).toBe('2027-05-02')
    expect(r3.date).toBe('2027-05-03')
    r1.tables.forEach(t => expect(t.date).toBe('2027-05-01'))
    r3.tables.forEach(t => expect(t.date).toBe('2027-05-03'))
  })

  it('单桌时段查询与列表查询的可用性完全一致', async () => {
    const list = await bookingStore.fetchTables('2027-05-01')
    const detail = await bookingStore.fetchSlots(3, '2027-05-01')
    const fromList = list.tables.find(t => t.id === 3)
    expect(detail.table.price).toBe(fromList.price)
    expect(detail.slots.map(s => s.available)).toEqual(
      fromList.slots.map(s => s.available)
    )
  })
})

describe('bookingStore 预约创建（快照一致性）', () => {
  function findBookable(tableId, date) {
    return bookingStore.fetchSlots(tableId, date).then(r => ({
      ...r,
      slot: r.slots.find(s => s.available)
    }))
  }

  it('落库记录的球桌/日期/时段/价格来自同一次快照，提交后改入参不影响结果', async () => {
    const date = '2027-05-10'
    const ctx = await findBookable(3, date)
    const payload = { tableId: 3, date, slotId: ctx.slot.id, duration: 2 }

    // 模拟提交后页面继续切换（原始变量被改写）
    const mutated = payload
    const result = await bookingStore.createBooking(mutated)
    mutated.date = '2027-05-11'
    mutated.slotId = 999
    mutated.duration = 4

    expect(result.success).toBe(true)
    const b = result.booking
    expect(b.tableId).toBe(3)
    expect(b.tableName).toBe('3号球桌')
    expect(b.tableType).toBe('美式九球')
    expect(b.date).toBe('2027-05-10')
    expect(b.slotId).toBe(ctx.slot.id)
    expect(b.time).toBe(ctx.slot.time)
    expect(b.price).toBe(60)
    expect(b.duration).toBe(2)
    expect(b.amount).toBe(120)
    expect(b.orderNo).toMatch(/^BK\d+$/)
  })

  it('预约成功后对应球桌当日该时段立即变为占用，其他日期不受影响', async () => {
    const date = '2027-05-12'
    const ctx = await findBookable(4, date)
    const result = await bookingStore.createBooking({
      tableId: 4,
      date,
      slotId: ctx.slot.id,
      duration: 1
    })
    expect(result.success).toBe(true)

    const after = await bookingStore.fetchSlots(4, date)
    const taken = after.slots.find(s => s.id === ctx.slot.id)
    expect(taken.available).toBe(false)

    const otherDay = await bookingStore.fetchSlots(4, '2027-05-13')
    expect(otherDay.slots.find(s => s.id === ctx.slot.id)?.available).toBe(true)
  })

  it('同一场次不能被重复预约', async () => {
    const date = '2027-05-15'
    const ctx = await findBookable(5, date)
    const first = await bookingStore.createBooking({
      tableId: 5, date, slotId: ctx.slot.id, duration: 1
    })
    expect(first.success).toBe(true)

    const second = await bookingStore.createBooking({
      tableId: 5, date, slotId: ctx.slot.id, duration: 1
    })
    expect(second.success).toBe(false)
    expect(second.error).toContain('刚刚被预约')
  })

  it('拒绝过去日期与无效时段', async () => {
    const result = await bookingStore.createBooking({
      tableId: 1,
      date: '2000-01-01',
      slotId: 1,
      duration: 2
    })
    expect(result.success).toBe(false)

    const invalid = await bookingStore.createBooking({
      tableId: 1,
      date: '2027-05-20',
      slotId: 999,
      duration: 2
    })
    expect(invalid.success).toBe(false)
  })

  it('store 订阅者在创建/取消时收到通知', async () => {
    const listener = vi.fn()
    bookingStore.subscribe(listener)
    const date = '2027-05-18'
    const ctx = await findBookable(6, date)
    const result = await bookingStore.createBooking({
      tableId: 6, date, slotId: ctx.slot.id, duration: 2
    })
    expect(listener).toHaveBeenCalledTimes(1)

    bookingStore.cancelBooking(result.booking.orderNo)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('bookingStore 取消记录', () => {
  it('取消后记录保留为 cancelled，且该场次重新可约', async () => {
    const date = '2027-05-20'
    const slots = await bookingStore.fetchSlots(1, date)
    const slot = slots.slots.find(s => s.available)

    const created = await bookingStore.createBooking({
      tableId: 1, date, slotId: slot.id, duration: 3
    })
    const orderNo = created.booking.orderNo

    const cancelled = bookingStore.cancelBooking(orderNo)
    expect(cancelled.status).toBe('cancelled')
    // 记录仍可查到，没有被删除
    expect(bookingStore.getBooking(orderNo).status).toBe('cancelled')

    const reopened = await bookingStore.fetchSlots(1, date)
    expect(reopened.slots.find(s => s.id === slot.id).available).toBe(true)
  })
})

describe('预约记录与任务中心同源', () => {
  it('addBookingTask 直接使用预约记录，任务金额/时间/订单号与预约一致', async () => {
    const date = '2027-05-22'
    const slots = await bookingStore.fetchSlots(2, date)
    const slot = slots.slots.find(s => s.available)

    const created = await bookingStore.createBooking({
      tableId: 2, date, slotId: slot.id, duration: 4
    })
    expect(created.success).toBe(true)

    const task = taskStore.addBookingTask(created.booking)
    expect(task.extra.orderNo).toBe(created.booking.orderNo)
    expect(task.extra.tableId).toBe(2)
    expect(task.extra.date).toBe(date)
    expect(task.extra.time).toBe(slot.time)
    expect(task.extra.price).toBe(80)
    expect(task.extra.duration).toBe(4)
    expect(task.amount).toBe(320)
  })

  it('cancelTask 保留记录并出现在已完成归档中', () => {
    const task = taskStore.addBookingTask({
      orderNo: 'BKTEST001',
      tableId: 1,
      tableName: '1号球桌',
      tableType: '斯诺克',
      price: 80,
      date: '2027-05-25',
      slotId: 1,
      time: '10:00 - 12:00',
      duration: 2,
      amount: 160,
      status: 'pending_payment'
    })

    taskStore.cancelTask(task.id)
    const archived = taskStore.getByStatus('completed')
    expect(archived.some(t => t.id === task.id && t.status === 'cancelled')).toBe(true)
    expect(taskStore.getByStatus('pending').some(t => t.id === task.id)).toBe(false)
  })
})
