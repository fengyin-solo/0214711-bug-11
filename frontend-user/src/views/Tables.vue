<template>
  <div class="tables-page">
    <header class="page-header">
      <div class="header-content">
        <span class="page-tag">在线预约</span>
        <h1>球桌预约</h1>
        <p>选择您喜欢的球桌类型，开始您的台球时光</p>
      </div>
    </header>

    <div class="filter-section">
      <div class="filter-group">
        <div class="filter-tabs">
          <button
            v-for="type in tableTypes"
            :key="type.id"
            :class="{ active: selectedType === type.id }"
            @click="selectType(type.id)"
          >
            <span class="tab-icon">{{ type.icon }}</span>
            <span>{{ type.name }}</span>
          </button>
        </div>
      </div>
      <div class="filter-right">
        <div class="date-picker">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          <input v-model="selectedDate" type="date" :min="today" />
        </div>
      </div>
    </div>

    <div class="tables-grid" :class="{ loading: isLoadingTables }">
      <div v-if="isLoadingTables" class="loading-overlay">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>
      <div
        v-for="table in filteredTables"
        :key="table.id"
        class="table-card"
        :class="{ available: table.available, unavailable: !table.available }"
      >
        <div class="card-header">
          <div class="table-type-badge">{{ table.type }}</div>
          <div class="status-indicator" :class="table.available ? 'online' : 'offline'">
            <span class="status-dot"></span>
            <span>{{ table.available ? '可预约' : '已占用' }}</span>
          </div>
        </div>

        <div class="table-visual">
          <div class="table-3d">
            <div class="table-surface">
              <div class="pocket tl"></div>
              <div class="pocket tr"></div>
              <div class="pocket ml"></div>
              <div class="pocket mr"></div>
              <div class="pocket bl"></div>
              <div class="pocket br"></div>
            </div>
          </div>
        </div>

        <div class="card-content">
          <h3>{{ table.name }}</h3>
          <div class="table-specs">
            <div class="spec">
              <span class="spec-label">尺寸</span>
              <span class="spec-value">{{ table.size }}</span>
            </div>
            <div class="spec">
              <span class="spec-label">品牌</span>
              <span class="spec-value">{{ table.brand }}</span>
            </div>
          </div>
          <div class="price-row">
            <div class="price">
              <span class="amount">¥{{ table.price }}</span>
              <span class="unit">/小时</span>
            </div>
            <button
              class="btn-book"
              :disabled="isLoadingTables || !table.available"
              @click="openBooking(table)"
            >
              {{ isLoadingTables ? '加载中...' : table.available ? '立即预约' : '暂不可用' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Booking Modal -->
    <Modal
      v-model="showBookingModal"
      title="预约球桌"
      subtitle="请选择预约时段"
      size="medium"
      confirm-text="确认预约"
      :loading="bookingLoading"
      :confirm-disabled="!canConfirmBooking"
      :show-close="!bookingLoading"
      :show-cancel="!bookingLoading"
      :close-on-overlay="!bookingLoading"
      @confirm="confirmBooking"
      @cancel="onBookingModalCancel"
    >
      <div v-if="selectedTable" class="booking-form">
        <div class="booking-table-info">
          <div class="table-preview">
            <div class="preview-surface"></div>
          </div>
          <div class="table-details">
            <h4>{{ selectedTable.name }}</h4>
            <p>{{ selectedTable.type }} · {{ selectedTable.brand }}</p>
            <span class="table-price">¥{{ selectedTable.price }}/小时</span>
          </div>
        </div>

        <div class="form-group">
          <label>预约日期</label>
          <div class="date-input">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <input v-model="bookingDate" type="date" :min="today" :disabled="bookingLoading" />
          </div>
        </div>

        <div class="form-group">
          <label>选择时段</label>
          <div class="time-slots" :class="{ loading: isLoadingSlots }">
            <div v-if="isLoadingSlots" class="slots-loading">
              <div class="loading-spinner small"></div>
              <span>时段加载中...</span>
            </div>
            <template v-else>
              <button
                v-for="slot in timeSlots"
                :key="slot.id"
                class="time-slot"
                :class="{ active: selectedTimeSlot === slot.id, disabled: !slot.available }"
                :disabled="!slot.available || bookingLoading"
                @click="selectTimeSlot(slot.id)"
              >
                <span class="slot-time">{{ slot.time }}</span>
                <span class="slot-status">{{ slot.available ? '可预约' : '已满' }}</span>
              </button>
            </template>
          </div>
        </div>

        <div class="form-group">
          <label>预约时长</label>
          <div class="duration-selector">
            <button
              v-for="d in durations"
              :key="d"
              class="duration-btn"
              :class="{ active: duration === d }"
              :disabled="bookingLoading"
              @click="selectDuration(d)"
            >
              {{ d }}小时
            </button>
          </div>
        </div>

        <div class="booking-summary">
          <div class="summary-row">
            <span>球桌费用</span>
            <span>¥{{ selectedTable.price }} × {{ duration }}小时</span>
          </div>
          <div class="summary-row total">
            <span>合计</span>
            <span class="total-price">¥{{ selectedTable.price * duration }}</span>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Success Modal -->
    <Modal
      v-model="showSuccessModal"
      icon="🎉"
      icon-type="success"
      title="预约成功"
      :subtitle="successMessage"
      size="small"
      :show-cancel="false"
      confirm-text="我知道了"
      @confirm="showSuccessModal = false"
    >
      <div v-if="bookingResult" class="success-details">
        <div class="detail-item">
          <span class="label">预约编号</span>
          <span class="value">{{ bookingResult.orderNo }}</span>
        </div>
        <div class="detail-item">
          <span class="label">球桌</span>
          <span class="value">{{ bookingResult.tableName }}</span>
        </div>
        <div class="detail-item">
          <span class="label">时间</span>
          <span class="value">{{ bookingResult.date }} {{ bookingResult.time }}</span>
        </div>
        <div class="detail-item">
          <span class="label">金额</span>
          <span class="value">¥{{ bookingResult.amount }}</span>
        </div>
      </div>
    </Modal>

    <!-- Toast -->
    <Toast v-model="showToast" :type="toastType" :title="toastTitle" :message="toastMessage" />

    <!-- Login Modal -->
    <LoginModal v-model="showLoginModal" @success="onLoginSuccess" />
  </div>
</template>

<script>
import Modal from '../components/Modal.vue'
import Toast from '../components/Toast.vue'
import LoginModal from '../components/LoginModal.vue'
import { isAuthenticated } from '../utils/auth'
import { taskStore } from '../utils/taskStore'
import { bookingStore } from '../utils/bookingStore'

export default {
  name: 'Tables',
  components: { Modal, Toast, LoginModal },
  data() {
    return {
      selectedType: 'all',
      selectedDate: bookingStore.getToday(),
      isLoadingTables: false,
      showBookingModal: false,
      showSuccessModal: false,
      bookingLoading: false,
      isLoadingSlots: false,
      // 预约弹窗内的权威数据（由最近一次 slots 响应填充）
      selectedTable: null,
      bookingDate: bookingStore.getToday(),
      timeSlots: [],
      selectedTimeSlot: null,
      duration: 2,
      durations: [1, 2, 3, 4],
      bookingResult: null,
      successMessage: '',
      showToast: false,
      toastType: 'success',
      toastTitle: '',
      toastMessage: '',
      showLoginModal: false,
      pendingTable: null,
      tableTypes: bookingStore.TABLE_TYPES,
      tables: [],
      // 请求序号：快速连续切换时只接受最后一次响应
      tablesRequestId: null,
      slotsRequestId: null,
      bookingRequestId: null,
      // 初始化时静默设置日期，避免与首屏加载竞态
      skipDateWatch: false,
      unsubscribeStore: null
    }
  },
  computed: {
    filteredTables() {
      if (this.selectedType === 'all') return this.tables
      return this.tables.filter(t => t.typeId === this.selectedType)
    },
    today() {
      return bookingStore.getToday()
    },
    canConfirmBooking() {
      // 加载中、无有效时段、时段已满、日期早于今天时禁止提交
      if (this.bookingLoading || this.isLoadingSlots || !this.selectedTable) return false
      const slot = this.timeSlots.find(s => s.id === this.selectedTimeSlot)
      return !!(slot && slot.available) && this.bookingDate >= this.today
    }
  },
  watch: {
    selectedDate(newDate) {
      if (this.skipDateWatch) {
        this.skipDateWatch = false
        return
      }
      if (!newDate) return
      this.loadTables(newDate)
    },
    bookingDate(newDate) {
      // 弹窗内改日期：重新拉取该球桌当日时段，并丢弃旧选择
      if (!this.showBookingModal || !this.selectedTable || this.bookingLoading) return
      if (!newDate || newDate < this.today) return
      this.loadSlots(this.selectedTable.id, newDate)
    }
  },
  async mounted() {
    this.unsubscribeStore = bookingStore.subscribe(this.onBookingStoreChange)

    const query = this.$route.query
    const queryTableId = query.tableId ? Number(query.tableId) : null
    const queryDate = query.date

    if (queryDate && queryDate !== this.selectedDate) {
      this.skipDateWatch = true
      this.selectedDate = queryDate
    }

    await this.loadTables(this.selectedDate)

    // 从任务中心「再次预约」进入：定位球桌并直接打开预约弹窗
    if (queryTableId && bookingStore.getBaseTable(queryTableId)) {
      const table = this.tables.find(t => t.id === queryTableId)
      if (table) this.openBooking(table)
      this.$router.replace({ path: '/tables' }).catch(() => {})
    }
  },
  beforeUnmount() {
    if (this.unsubscribeStore) this.unsubscribeStore()
    // 离开页面后让所有在途响应失效，避免销毁实例上的状态回写
    this.tablesRequestId = null
    this.slotsRequestId = null
    this.bookingRequestId = null
  },
  methods: {
    selectType(typeId) {
      if (this.selectedType === typeId) return
      this.selectedType = typeId
      // 类型仅做前端过滤，不需要重新请求；不改动任何球桌的可用状态
    },

    /**
     * 加载某日球桌列表。快速连续切换日期时，
     * 只有最后一次请求的响应会被采纳。
     */
    async loadTables(date = this.selectedDate) {
      const requestId = `tables-${Date.now()}-${Math.random().toString(36).slice(2)}`
      this.tablesRequestId = requestId
      this.isLoadingTables = true
      try {
        const result = await bookingStore.fetchTables(date)
        if (this.tablesRequestId !== requestId) return // 过期响应，丢弃
        this.tables = result.tables

        // 弹窗打开期间数据被刷新（如预约成功），同步弹窗内球桌快照
        if (this.showBookingModal && this.selectedTable) {
          const fresh = result.tables.find(t => t.id === this.selectedTable.id)
          if (fresh) this.timeSlots = fresh.slots
        }
      } catch (e) {
        if (this.tablesRequestId !== requestId) return
        this.showNotification('error', '加载失败', '球桌信息加载失败，请稍后重试')
      } finally {
        if (this.tablesRequestId === requestId) {
          this.isLoadingTables = false
        }
      }
    },

    onBookingStoreChange() {
      // 预约成功 / 取消后，用同一份记录刷新列表占用状态
      this.loadTables(this.selectedDate)
    },

    /**
     * 加载某球桌某日的时段。旧响应一律丢弃，防止串位。
     */
    async loadSlots(tableId, date) {
      const requestId = `slots-${Date.now()}-${Math.random().toString(36).slice(2)}`
      this.slotsRequestId = requestId
      this.isLoadingSlots = true
      this.selectedTimeSlot = null
      try {
        const result = await bookingStore.fetchSlots(tableId, date)
        if (this.slotsRequestId !== requestId) return // 过期响应，丢弃
        if (!this.showBookingModal) return // 弹窗已关，丢弃
        if (!result.table) {
          this.showNotification('error', '球桌不存在', '请重新选择球桌')
          this.showBookingModal = false
          return
        }
        // 以本次响应为权威快照：球桌、价格、时段严格对应 tableId + date
        this.selectedTable = result.table
        this.timeSlots = result.slots
        const firstAvailable = result.slots.find(s => s.available)
        this.selectedTimeSlot = firstAvailable ? firstAvailable.id : null
      } catch (e) {
        if (this.slotsRequestId !== requestId) return
        this.showNotification('error', '加载失败', '时段信息加载失败，请稍后重试')
      } finally {
        if (this.slotsRequestId === requestId) {
          this.isLoadingSlots = false
        }
      }
    },

    openBooking(table) {
      // 列表加载中禁止打开，防止拿到上一批日期/类型的旧球桌
      if (this.isLoadingTables) return

      // 检查是否已登录
      if (!isAuthenticated()) {
        this.pendingTable = table
        this.showLoginModal = true
        return
      }

      // 以当前列表日期为准建立本次预约上下文
      this.selectedTable = table
      this.bookingDate = this.selectedDate
      this.duration = 2
      this.selectedTimeSlot = null
      this.timeSlots = []
      this.showBookingModal = true
      this.loadSlots(table.id, this.bookingDate)
    },

    /** 登录成功回调（LoginModal 抛出 success 事件） */
    onLoginSuccess() {
      this.showLoginModal = false
      if (this.pendingTable) {
        const table = this.pendingTable
        this.pendingTable = null
        this.openBooking(table)
      }
    },

    selectTimeSlot(slotId) {
      if (this.bookingLoading || this.isLoadingSlots) return
      this.selectedTimeSlot = slotId
    },

    selectDuration(d) {
      if (this.bookingLoading) return
      this.duration = d
    },

    onBookingModalCancel() {
      // 提交进行中不允许关闭弹窗，避免请求返回后写入一个已被放弃的预约
      if (this.bookingLoading) {
        this.showBookingModal = true
      } else {
        this.slotsRequestId = null
        this.selectedTable = null
        this.selectedTimeSlot = null
      }
    },

    async confirmBooking() {
      if (this.bookingLoading || this.isLoadingSlots) return

      // 提交前校验：球桌、日期、时段、时长必须来自同一份快照
      const table = this.selectedTable
      const date = this.bookingDate
      const slot = this.timeSlots.find(s => s.id === this.selectedTimeSlot)
      const duration = this.duration

      if (!table) {
        this.showNotification('error', '预约失败', '球桌信息缺失，请重新选择')
        return
      }
      if (!date || date < this.today) {
        this.showNotification('error', '预约失败', '请选择有效的预约日期')
        return
      }
      if (!slot || !slot.available) {
        this.showNotification('error', '预约失败', '请选择可用的预约时段')
        return
      }

      // 提交时刻快照 —— 此后弹窗输入已锁定，服务端响应也以此为准，
      // 列表/日期/类型再切换都不会污染本次预约
      const snapshot = {
        tableId: table.id,
        date,
        slotId: slot.id,
        duration
      }

      const requestId = `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`
      this.bookingRequestId = requestId
      this.bookingLoading = true

      try {
        const result = await bookingStore.createBooking(snapshot)
        if (this.bookingRequestId !== requestId) return
        if (!this.showBookingModal) return

        if (!result.success) {
          this.showNotification('error', '预约失败', result.error || '请稍后重试')
          // 占用状态可能已变化，重新校验时段
          await this.loadSlots(snapshot.tableId, snapshot.date)
          return
        }

        const booking = result.booking

        // 成功结果与任务数据都来自同一条预约记录
        this.bookingResult = {
          orderNo: booking.orderNo,
          tableName: `${booking.tableName} - ${booking.tableType}`,
          date: booking.date,
          time: booking.time,
          price: booking.price,
          duration: booking.duration,
          amount: booking.amount
        }
        this.successMessage = `${booking.date} ${booking.time}`
        taskStore.addBookingTask(booking)

        this.showBookingModal = false
        this.showSuccessModal = true
        this.showNotification('info', '已添加到任务中心', '您可以在任务中心查看并管理此预约')

        // 用最新占用状态刷新列表（store 订阅也会触发，这里无需重复调用）
      } catch (e) {
        if (this.bookingRequestId !== requestId) return
        this.showNotification('error', '预约失败', '网络异常，请稍后重试')
      } finally {
        if (this.bookingRequestId === requestId) {
          this.bookingLoading = false
        }
      }
    },

    showNotification(type, title, message) {
      this.toastType = type
      this.toastTitle = title
      this.toastMessage = message
      this.showToast = true
    }
  }
}
</script>

<style scoped>
.tables-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 3rem 4rem;
}

.page-header {
  text-align: center;
  padding: 2rem 0 4rem;
}

.page-tag {
  display: inline-block;
  background: rgba(0, 217, 165, 0.1);
  color: var(--primary);
  padding: 0.5rem 1rem;
  border-radius: 50px;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

.page-header h1 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.page-header p {
  color: var(--text-secondary);
  font-size: 1.1rem;
}

/* Filter Section */
.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.filter-tabs {
  display: flex;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.4rem;
  gap: 0.25rem;
}

.filter-tabs button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  padding: 0.75rem 1.25rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.filter-tabs button:hover {
  color: var(--text-primary);
}

.filter-tabs button.active {
  background: var(--primary);
  color: var(--bg-dark);
}

.tab-icon {
  font-size: 1rem;
}

.date-picker {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.75rem 1rem;
}

.date-picker svg {
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
}

.date-picker input {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
}

.date-picker input::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}

/* Tables Grid */
.tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1.5rem;
  position: relative;
  min-height: 200px;
}

.tables-grid.loading {
  pointer-events: none;
}

.tables-grid.loading .table-card {
  opacity: 0.3;
  filter: blur(2px);
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  z-index: 10;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner.small {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.table-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.table-card.available:hover {
  transform: translateY(-6px);
  border-color: var(--primary);
  box-shadow: var(--shadow-glow);
}

.table-card.unavailable {
  opacity: 0.6;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
}

.table-type-badge {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator.online .status-dot {
  background: var(--primary);
  box-shadow: 0 0 10px var(--primary);
}

.status-indicator.online {
  color: var(--primary);
}

.status-indicator.offline .status-dot {
  background: #ff6b6b;
}

.status-indicator.offline {
  color: #ff6b6b;
}

/* Table Visual */
.table-visual {
  padding: 1rem 1.5rem;
}

.table-3d {
  perspective: 500px;
}

.table-surface {
  position: relative;
  height: 100px;
  background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%);
  border-radius: 8px;
  border: 6px solid #5D4037;
  box-shadow:
    inset 0 0 20px rgba(0,0,0,0.3),
    0 10px 30px rgba(0,0,0,0.3);
  transform: rotateX(10deg);
}

.pocket {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #1a1a1a;
  border-radius: 50%;
}

.pocket.tl { top: 4px; left: 4px; }
.pocket.tr { top: 4px; right: 4px; }
.pocket.ml { top: 50%; left: 4px; transform: translateY(-50%); }
.pocket.mr { top: 50%; right: 4px; transform: translateY(-50%); }
.pocket.bl { bottom: 4px; left: 4px; }
.pocket.br { bottom: 4px; right: 4px; }

/* Card Content */
.card-content {
  padding: 1.25rem 1.5rem 1.5rem;
}

.card-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.table-specs {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.25rem;
}

.spec {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.spec-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.spec-value {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border);
}

.price .amount {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}

.price .unit {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.btn-book {
  background: var(--gradient-1);
  color: var(--bg-dark);
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-book:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 5px 20px var(--primary-glow);
}

.btn-book:disabled {
  background: var(--bg-card-hover);
  color: var(--text-muted);
  cursor: not-allowed;
}

/* Booking Form */
.booking-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.booking-table-info {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 14px;
}

.table-preview {
  width: 80px;
  height: 50px;
  flex-shrink: 0;
}

.preview-surface {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%);
  border-radius: 6px;
  border: 4px solid #5D4037;
}

.table-details h4 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.table-details p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.table-price {
  font-size: 0.9rem;
  color: var(--primary);
  font-weight: 600;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.date-input {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.75rem 1rem;
}

.date-input svg {
  width: 18px;
  height: 18px;
  color: var(--text-secondary);
}

.date-input input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
}

.date-input input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.date-input input::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}

.time-slots {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  position: relative;
  min-height: 96px;
}

.slots-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  grid-column: 1 / -1;
}

.time-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.time-slot:hover:not(.disabled) {
  border-color: var(--primary);
}

.time-slot.active {
  background: rgba(0, 217, 165, 0.1);
  border-color: var(--primary);
}

.time-slot.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.slot-time {
  font-size: 0.9rem;
  font-weight: 500;
}

.slot-status {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.time-slot.active .slot-status {
  color: var(--primary);
}

.duration-selector {
  display: flex;
  gap: 0.5rem;
}

.duration-btn {
  flex: 1;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.duration-btn:hover:not(:disabled) {
  border-color: var(--primary);
}

.duration-btn.active {
  background: rgba(0, 217, 165, 0.1);
  border-color: var(--primary);
  color: var(--primary);
}

.duration-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.booking-summary {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: var(--text-secondary);
  padding: 0.5rem 0;
}

.summary-row.total {
  border-top: 1px solid var(--border);
  margin-top: 0.5rem;
  padding-top: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.total-price {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.25rem;
  color: var(--primary);
}

/* Success Details */
.success-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  text-align: left;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.detail-item .label {
  color: var(--text-secondary);
}

.detail-item .value {
  font-weight: 500;
}

@media (max-width: 768px) {
  .tables-page {
    padding: 0 1.5rem 3rem;
  }

  .page-header h1 {
    font-size: 2rem;
  }

  .filter-section {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-tabs {
    overflow-x: auto;
  }

  .tables-grid {
    grid-template-columns: 1fr;
  }

  .time-slots {
    grid-template-columns: 1fr;
  }
}
</style>
