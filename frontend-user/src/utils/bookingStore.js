/**
 * 球桌预约数据模块
 *
 * 统一承载：球桌基础数据、按「球桌+日期」计算的可用状态与时段、
 * 预约创建/取消、以及跨页面的一致性同步。
 *
 * 关键设计：
 * - 所有写操作以“提交时快照”为准（tableId/date/slotId/duration/price），
 *   响应返回后不再读取页面上可能已被切换的可变状态，杜绝串位。
 * - 每个异步请求返回 requestId，调用方只接受最后一次请求的结果，
 *   快速连续切换日期/球桌/类型时旧响应不会覆盖新状态。
 * - 预约记录持久化在 localStorage，球桌与时段的占用状态完全由
 *   同一份预约记录推导，保证「球桌列表 / 预约弹窗 / 成功结果 /
 *   任务中心 / 取消记录」始终对应同一次预约。
 */

const STORAGE_KEY = 'billiard_bookings_v1'

// 6 个营业时段（slotId 从 1 开始）
const TIME_SLOTS = [
  { id: 1, time: '10:00 - 12:00' },
  { id: 2, time: '12:00 - 14:00' },
  { id: 3, time: '14:00 - 16:00' },
  { id: 4, time: '16:00 - 18:00' },
  { id: 5, time: '18:00 - 20:00' },
  { id: 6, time: '20:00 - 22:00' }
]

// 球桌基础数据（价格等静态属性的唯一数据源）
const BASE_TABLES = [
  { id: 1, name: '1号球桌', type: '斯诺克', typeId: 'snooker', price: 80, size: '12尺', brand: '星牌' },
  { id: 2, name: '2号球桌', type: '斯诺克', typeId: 'snooker', price: 80, size: '12尺', brand: '星牌' },
  { id: 3, name: '3号球桌', type: '美式九球', typeId: 'pool', price: 60, size: '9尺', brand: 'Brunswick' },
  { id: 4, name: '4号球桌', type: '美式九球', typeId: 'pool', price: 60, size: '9尺', brand: 'Brunswick' },
  { id: 5, name: '5号球桌', type: '中式八球', typeId: 'chinese', price: 50, size: '9尺', brand: '乔氏' },
  { id: 6, name: '6号球桌', type: '中式八球', typeId: 'chinese', price: 50, size: '9尺', brand: '乔氏' }
]

const ACTIVE_STATUSES = ['pending_payment', 'upcoming', 'ongoing']

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 由 (tableId, date, slotId) 确定性地推导该时段是否被场馆关闭维护。
 * 同一天内多次调用结果一致，避免随机数导致的列表/弹窗状态漂移。
 */
function isSlotClosed(tableId, date, slotId) {
  const seedStr = `${tableId}|${date}|${slotId}`
  let hash = 0
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0
  }
  // 约 1/5 的时段被标记为维护（“已满”），且 2 天后不安排维护，
  // 保证演示流程里总有可预约时段。
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date + 'T00:00:00')
  const diffDays = Math.round((target - today) / 86400000)
  return diffDays <= 1 && hash % 5 === 0
}

function loadBookings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch (e) {
    console.error('[bookingStore] 加载预约记录失败', e)
    return []
  }
}

function saveBookings(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('[bookingStore] 保存预约记录失败', e)
  }
}

// 跨页面/跨组件的占用状态变更通知（预约成功、取消后同步刷新）
const listeners = new Set()
function notifyChange() {
  listeners.forEach(fn => {
    try {
      fn()
    } catch (e) {
      console.error('[bookingStore] 订阅回调异常', e)
    }
  })
}

function isActiveBooking(b) {
  return ACTIVE_STATUSES.includes(b.status)
}

function isOccupied(booking, tableId, date, slotId) {
  return (
    isActiveBooking(booking) &&
    booking.tableId === tableId &&
    booking.date === date &&
    booking.slotId === slotId
  )
}

function buildTable(base, date) {
  const bookings = loadBookings()
  const takenSlotIds = new Set(
    bookings
      .filter(b => isOccupied(b, base.id, date, b.slotId))
      .map(b => b.slotId)
  )
  const slots = TIME_SLOTS.map(s => {
    const closed = isSlotClosed(base.id, date, s.id)
    return {
      id: s.id,
      time: s.time,
      available: !closed && !takenSlotIds.has(s.id),
      reason: takenSlotIds.has(s.id) ? 'taken' : closed ? 'closed' : null
    }
  })
  return {
    ...base,
    date,
    available: slots.some(s => s.available),
    slots
  }
}

export const bookingStore = {
  TABLE_TYPES: [
    { id: 'all', name: '全部', icon: '🎱' },
    { id: 'snooker', name: '斯诺克', icon: '🟢' },
    { id: 'pool', name: '美式九球', icon: '🟡' },
    { id: 'chinese', name: '中式八球', icon: '⚫' }
  ],

  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  getBaseTable(tableId) {
    return BASE_TABLES.find(t => t.id === Number(tableId)) || null
  },

  getToday() {
    const d = new Date()
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  },

  /**
   * 查询指定日期的球桌列表（含每个球桌当日时段状态）。
   * 返回 requestId，调用方据此丢弃过期响应。
   */
  async fetchTables(date) {
    const requestId = `tables-${date}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await delay(600)
    const tables = BASE_TABLES.map(base => buildTable(base, date))
    return { requestId, date, tables }
  },

  /**
   * 查询单个球桌在指定日期的时段。
   */
  async fetchSlots(tableId, date) {
    const requestId = `slots-${tableId}-${date}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await delay(400)
    const base = this.getBaseTable(tableId)
    if (!base) {
      return { requestId, tableId: Number(tableId), date, table: null, slots: [] }
    }
    const table = buildTable(base, date)
    return { requestId, tableId: Number(tableId), date, table, slots: table.slots }
  },

  /**
   * 创建预约。payload 为提交时刻的快照，请求期间页面再怎么切换
   * 都不会影响落库内容；返回的记录与快照一一对应。
   */
  async createBooking(payload) {
    const requestId = `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const tableId = Number(payload.tableId)
    const slotId = Number(payload.slotId)
    const { date, duration } = payload
    const table = this.getBaseTable(tableId)
    const slot = TIME_SLOTS.find(s => s.id === slotId)

    if (!table || !slot || !date || ![1, 2, 3, 4].includes(Number(duration))) {
      const error = new Error('预约信息不完整，请重新选择')
      return { requestId, success: false, error: error.message }
    }
    if (date < this.getToday()) {
      return { requestId, success: false, error: '不能预约过去的日期' }
    }

    await delay(1200)

    // 提交后再校验一次占用，防止同一场次被并发约走
    const bookings = loadBookings()
    const duplicated = bookings.some(b => isOccupied(b, tableId, date, slotId))
    if (duplicated || isSlotClosed(tableId, date, slotId)) {
      return { requestId, success: false, error: '该时段刚刚被预约，请选择其他时段' }
    }

    const orderNo = 'BK' + Date.now().toString().slice(-8)
    const record = {
      orderNo,
      tableId,
      tableName: table.name,
      tableType: table.type,
      tableTypeId: table.typeId,
      price: table.price,
      date,
      slotId,
      time: slot.time,
      duration: Number(duration),
      amount: table.price * Number(duration),
      status: 'pending_payment',
      createdAt: new Date().toISOString()
    }
    bookings.push(record)
    saveBookings(bookings)
    notifyChange()

    return { requestId, success: true, booking: record }
  },

  /**
   * 取消预约：保留记录（状态置为 cancelled），同时释放占用。
   */
  cancelBooking(orderNo) {
    const bookings = loadBookings()
    const target = bookings.find(b => b.orderNo === orderNo)
    if (!target) return null
    target.status = 'cancelled'
    target.cancelledAt = new Date().toISOString()
    saveBookings(bookings)
    notifyChange()
    return { ...target }
  },

  getBooking(orderNo) {
    return loadBookings().find(b => b.orderNo === orderNo) || null
  },

  getBookings() {
    return loadBookings().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }
}

export default bookingStore
