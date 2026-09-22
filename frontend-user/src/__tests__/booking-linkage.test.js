/**
 * 球桌预约联动测试（真实 mock 接口 + 真实 taskStore）
 *
 * 覆盖：
 * - 同一 (球桌, 日期) 的列表可用状态与时段结果一致
 * - 同参数重复查询结果稳定（无随机错位）
 * - 切换日期得到各自独立的结果
 * - 下单后该时段立即被占用，任务记录与响应来自同一次预约
 * - 取消任务后占用释放，可再次预约
 * - 重复下单同一时段被拦截
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import api, { TABLE_TIME_SLOTS } from '../utils/api'
import taskStore from '../utils/taskStore'

const DATE = '2027-06-15'

// mock 请求带 500-1000ms 随机延迟；假计时器下先创建 Promise 再推进计时器使其 resolve
async function call(promise) {
  await vi.runAllTimersAsync()
  return promise
}

function findBookingTasks() {
  return taskStore.getAll().filter(t => t.type === 'booking')
}

describe('球桌预约数据联动', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('同一日期下球桌 available 与其时段结果严格对应', async () => {
    const tablesRes = await call(api.getTables({ date: DATE }))
    expect(tablesRes.success).toBe(true)
    expect(tablesRes.data.length).toBe(6)

    for (const table of tablesRes.data) {
      const slotsRes = await call(api.getTableSlots({ tableId: table.id, date: DATE }))
      expect(slotsRes.success).toBe(true)
      const hasOpenSlot = slotsRes.data.some(s => s.available)
      expect(table.available).toBe(hasOpenSlot)
      // 时段集合始终是固定的营业时段，不会缺项/错位
      expect(slotsRes.data.map(s => s.time)).toEqual(TABLE_TIME_SLOTS.map(s => s.time))
    }
  })

  it('相同参数连续查询返回相同结果（快速切换不产生随机差异）', async () => {
    const first = await call(api.getTables({ type: 'snooker', date: DATE }))
    const second = await call(api.getTables({ type: 'snooker', date: DATE }))
    expect(second.data).toEqual(first.data)

    const slotsA = await call(api.getTableSlots({ tableId: 4, date: DATE }))
    const slotsB = await call(api.getTableSlots({ tableId: 4, date: DATE }))
    expect(slotsB.data).toEqual(slotsA.data)
  })

  it('切换日期得到与该日期对应的独立结果（不串用彼此数据）', async () => {
    const [day1, day2] = await call(Promise.all([
      api.getTables({ date: '2027-06-16' }),
      api.getTables({ date: '2027-06-17' })
    ]))
    // 球桌集合相同，顺序不丢不错位
    expect(day1.data.map(t => t.id)).toEqual(day2.data.map(t => t.id))

    // 逐球桌比较两天的时段占用分布，至少存在差异
    let anyDifference = false
    for (const table of day1.data) {
      const [s1, s2] = await call(Promise.all([
        api.getTableSlots({ tableId: table.id, date: '2027-06-16' }),
        api.getTableSlots({ tableId: table.id, date: '2027-06-17' })
      ]))
      if (JSON.stringify(s1.data) !== JSON.stringify(s2.data)) anyDifference = true
    }
    expect(anyDifference).toBe(true)
  })

  it('下单成功后该球桌该时段被占用，且任务记录来自同一次响应', async () => {
    const before = await call(api.getTableSlots({ tableId: 1, date: DATE }))
    const slot = before.data.find(s => s.available)
    expect(slot).toBeDefined()

    const res = await call(api.bookTable({
      tableId: 1,
      date: DATE,
      slotId: slot.id,
      timeSlot: slot.time,
      duration: 3
    }))
    expect(res.success).toBe(true)

    const after = await call(api.getTableSlots({ tableId: 1, date: DATE }))
    expect(after.data.find(s => s.id === slot.id).available).toBe(false)

    // 任务中心记录与响应快照一致
    const task = findBookingTasks().find(t => t.extra.orderNo === res.data.orderNo)
    expect(task).toBeDefined()
    expect(task.extra.tableId).toBe(1)
    expect(task.extra.date).toBe(DATE)
    expect(task.extra.slotId).toBe(slot.id)
    expect(task.extra.time).toBe(slot.time)
    expect(task.extra.price).toBe(res.data.price)
    expect(task.amount).toBe(res.data.amount)

    // 对同一时段重复下单必须被拒绝（防止并发/重复提交产生两条记录）
    const duplicate = await call(api.bookTable({
      tableId: 1,
      date: DATE,
      slotId: slot.id,
      timeSlot: slot.time,
      duration: 3
    }))
    expect(duplicate.success).toBe(false)
    expect(
      findBookingTasks().filter(t => t.extra?.tableId === 1 && t.extra?.date === DATE).length
    ).toBe(1)
  })

  it('取消任务后时段恢复可约，再次预约成功', async () => {
    const slots = await call(api.getTableSlots({ tableId: 3, date: DATE }))
    const slot = slots.data.find(s => s.available)
    expect(slot).toBeDefined()

    const res = await call(api.bookTable({
      tableId: 3,
      date: DATE,
      slotId: slot.id,
      timeSlot: slot.time,
      duration: 1
    }))
    expect(res.success).toBe(true)

    const task = findBookingTasks().find(t => t.extra.orderNo === res.data.orderNo)
    expect(taskStore.remove(task.id)).toBe(true)

    const refreshed = await call(api.getTableSlots({ tableId: 3, date: DATE }))
    expect(refreshed.data.find(s => s.id === slot.id).available).toBe(true)

    const rebook = await call(api.bookTable({
      tableId: 3,
      date: DATE,
      slotId: slot.id,
      timeSlot: slot.time,
      duration: 1
    }))
    expect(rebook.success).toBe(true)
  })

  it('对已不可约的时段下单会被拦截，且不产生任务', async () => {
    // 找到一个确定被营业计划关闭的 (球桌, 时段)
    let target
    for (let id = 1; id <= 6 && !target; id++) {
      const r = await call(api.getTableSlots({ tableId: id, date: DATE }))
      const closed = r.data.find(s => !s.available)
      if (closed) target = { tableId: id, slot: closed }
    }
    expect(target).toBeDefined()

    const countBefore = findBookingTasks().length
    const res = await call(api.bookTable({
      tableId: target.tableId,
      date: DATE,
      slotId: target.slot.id,
      timeSlot: target.slot.time,
      duration: 2
    }))
    expect(res.success).toBe(false)
    expect(findBookingTasks().length).toBe(countBefore)
  })

  it('GET /bookings 返回的预约与任务中心有效记录一致', async () => {
    const slots = await call(api.getTableSlots({ tableId: 5, date: DATE }))
    const slot = slots.data.find(s => s.available)
    expect(slot).toBeDefined()
    const res = await call(api.bookTable({
      tableId: 5,
      date: DATE,
      slotId: slot.id,
      timeSlot: slot.time,
      duration: 2
    }))

    const bookings = await call(api.getBookings())
    const found = bookings.data.find(b => b.orderNo === res.data.orderNo)
    expect(found).toMatchObject({
      tableId: 5,
      date: DATE,
      time: slot.time,
      status: 'pending_payment'
    })
  })
})
