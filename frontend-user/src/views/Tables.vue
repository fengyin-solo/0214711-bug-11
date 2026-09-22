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
            @click="selectedType = type.id"
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
          <input v-model="selectedDate" type="date" :min="today" :disabled="isLoadingTables" />
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
              :disabled="!table.available"
              @click="openBooking(table)"
            >
              {{ table.available ? '立即预约' : '暂不可用' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Booking Modal -->
    <Modal
      :model-value="showBookingModal"
      title="预约球桌"
      subtitle="请选择预约时段"
      size="medium"
      confirm-text="确认预约"
      :loading="bookingLoading"
      :confirm-disabled="!canConfirmBooking"
      :close-on-overlay="!bookingLoading"
      @update:model-value="onBookingModalToggle"
      @confirm="confirmBooking"
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
            <input v-model="bookingDate" type="date" :min="today" :disabled="bookingLoading || slotsLoading" />
          </div>
        </div>

        <div class="form-group">
          <label>选择时段</label>
          <div class="time-slots" :class="{ loading: slotsLoading }">
            <div v-if="slotsLoading" class="slots-loading">
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
              @click="duration = d"
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
      </div>
    </Modal>

    <!-- Toast -->
    <Toast v-model="showToast" :type="toastType" :title="toastTitle" :message="toastMessage" />

    <!-- Login Modal -->
    <LoginModal v-model="showLoginModal" @login-success="onLoginSuccess" />
  </div>
</template>

<script>
import Modal from '../components/Modal.vue'
import Toast from '../components/Toast.vue'
import LoginModal from '../components/LoginModal.vue'
import { isAuthenticated } from '../utils/auth'
import api, { TABLE_META } from '../utils/api'

function todayStr() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default {
  name: 'Tables',
  components: { Modal, Toast, LoginModal },
  data() {
    const today = todayStr()
    return {
      selectedType: 'all',
      selectedDate: today,
      tables: [],
      isLoadingTables: false,
      // 列表请求序号：只接受最后一次请求的响应，快速切换日期/类型时丢弃旧响应
      tablesRequestSeq: 0,
      tablesRequestKey: '',

      showBookingModal: false,
      showSuccessModal: false,
      bookingLoading: false,
      // 弹窗内球桌快照：打开弹窗时拷贝，之后列表刷新不会串改弹窗中的球桌与价格
      selectedTable: null,
      bookingDate: today,
      timeSlots: [],
      slotsLoading: false,
      slotsRequestSeq: 0,
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
      // 待登录后打开预约的球桌快照（同样不能引用会被刷新替换的列表对象）
      pendingTable: null,
      // “再次预约”带过来的球桌，等首次列表加载完成后自动打开
      pendingRebookTableId: null,
      // “再次预约”带过来的原时段（若仍可约则预选）
      pendingRebookSlotId: null,
      tableTypes: [
        { id: 'all', name: '全部', icon: '🎱' },
        { id: 'snooker', name: '斯诺克', icon: '🟢' },
        { id: 'pool', name: '美式九球', icon: '🟡' },
        { id: 'chinese', name: '中式八球', icon: '⚫' }
      ]
    }
  },
  computed: {
    filteredTables() {
      // 类型已作为请求参数发给接口，本地仍过滤一次保证展示与筛选严格一致
      if (this.selectedType === 'all') return this.tables
      return this.tables.filter(t => t.typeId === this.selectedType)
    },
    today() {
      return todayStr()
    },
    selectedSlot() {
      return this.timeSlots.find(s => s.id === this.selectedTimeSlot) || null
    },
    canConfirmBooking() {
      return (
        !this.bookingLoading &&
        !this.slotsLoading &&
        !!this.selectedTable &&
        !!this.selectedSlot &&
        this.selectedSlot.available &&
        this.bookingDate >= this.today
      )
    }
  },
  watch: {
    // 日期或类型切换都要重新请求，且共用同一个竞态闸门
    selectedDate(newDate) {
      if (!newDate) return
      this.loadTables()
    },
    selectedType() {
      this.loadTables()
    },
    // 弹窗内换日期 -> 该球桌当天的时段必须重新拉取
    bookingDate(newDate, oldDate) {
      if (newDate === oldDate) return
      if (!newDate) {
        // 输入被清空：作废在途请求并清空时段，不允许空日期下单
        this.slotsRequestSeq++
        this.slotsLoading = false
        this.timeSlots = []
        this.selectedTimeSlot = null
        return
      }
      if (this.showBookingModal && this.selectedTable) {
        this.loadSlots(this.selectedTable.id, newDate)
      }
    }
  },
  mounted() {
    // 支持从任务中心“再次预约/继续付款”带着球桌与日期回来
    const query = this.$route?.query || {}
    this.pendingRebookTableId = query.tableId != null ? Number(query.tableId) : null
    this.pendingRebookSlotId = query.slotId != null ? Number(query.slotId) : null
    if (query.date) {
      this.selectedDate = String(query.date)
      this.bookingDate = String(query.date)
    }
    if (this.pendingRebookTableId != null) {
      const target = TABLE_META.find(t => t.id === this.pendingRebookTableId)
      // 切到该球桌所属类型，保证球桌一定出现在本次请求的结果中
      if (target) this.selectedType = target.typeId
    }
    this.loadTables()
  },
  beforeUnmount() {
    // 离开页面后所有在途响应一律作废，避免回来后被旧响应覆盖
    this.tablesRequestSeq++
    this.slotsRequestSeq++
  },
  methods: {
    /**
     * 按当前 类型+日期 拉取球桌列表。
     * 仅最后一次请求可以落库；组件卸载后的响应也会被丢弃。
     */
    async loadTables(silent = false) {
      const seq = ++this.tablesRequestSeq
      const requestKey = `${this.selectedType}|${this.selectedDate}`
      this.tablesRequestKey = requestKey
      if (!silent) this.isLoadingTables = true

      try {
        const result = await api.getTables({ type: this.selectedType, date: this.selectedDate })
        // 旧响应或上下文已变化（用户又切了一次）-> 丢弃，杜绝错位
        if (seq !== this.tablesRequestSeq || this.tablesRequestKey !== requestKey) return

        if (result.success) {
          this.tables = result.data
          // 弹窗里的快照球桌仍保留原快照；列表刷新不影响正在进行的预约
        } else {
          this.tables = []
          this.showNotification('error', '加载失败', result.error || '球桌列表加载失败，请重试')
        }
      } catch (e) {
        if (seq === this.tablesRequestSeq) {
          this.tables = []
          this.showNotification('error', '加载失败', '网络异常，请稍后重试')
        }
      } finally {
        if (seq === this.tablesRequestSeq) this.isLoadingTables = false
      }

      // 首次加载完成后处理“再次预约”跳转
      if (seq === this.tablesRequestSeq && this.pendingRebookTableId != null) {
        const target = this.tables.find(t => t.id === this.pendingRebookTableId)
        const preferredSlotId = this.pendingRebookSlotId
        this.pendingRebookTableId = null
        this.pendingRebookSlotId = null
        if (target && target.available && isAuthenticated()) {
          this.openBooking(target, preferredSlotId)
        }
      }
    },

    /**
     * 拉取某球桌某日的时段；旧响应一律丢弃。
     * @param {number} preferredSlotId - 期望优先选中的时段（如“再次预约”带回的原时段）
     */
    async loadSlots(tableId, date, preferredSlotId = null) {
      if (date < this.today) {
        this.timeSlots = []
        this.selectedTimeSlot = null
        return
      }
      const seq = ++this.slotsRequestSeq
      this.slotsLoading = true
      try {
        const result = await api.getTableSlots({ tableId, date })
        if (seq !== this.slotsRequestSeq) return
        if (result.success) {
          this.timeSlots = result.data
          const firstAvailable = result.data.find(s => s.available)
          // 优先级：期望时段（仍可约）> 当前已选（仍可约）> 第一个可用时段
          const preferred = result.data.find(
            s => s.id === preferredSlotId && s.available
          )
          const currentStillValid = result.data.find(
            s => s.id === this.selectedTimeSlot && s.available
          )
          this.selectedTimeSlot = preferred
            ? preferred.id
            : currentStillValid
              ? currentStillValid.id
              : firstAvailable
                ? firstAvailable.id
                : null
        } else {
          this.timeSlots = []
          this.selectedTimeSlot = null
          this.showNotification('error', '时段加载失败', result.error || '请重试')
        }
      } catch (e) {
        if (seq === this.slotsRequestSeq) {
          this.timeSlots = []
          this.selectedTimeSlot = null
          this.showNotification('error', '时段加载失败', '网络异常，请稍后重试')
        }
      } finally {
        if (seq === this.slotsRequestSeq) this.slotsLoading = false
      }
    },

    openBooking(table, preferredSlotId = null) {
      // 加载中或球桌已不可约时禁止操作
      if (this.isLoadingTables || !table || !table.available) return
      if (!isAuthenticated()) {
        this.pendingTable = { ...table }
        this.showLoginModal = true
        return
      }
      // 快照：球桌、日期在本次预约中冻结
      this.selectedTable = { ...table }
      this.bookingDate = this.selectedDate
      this.duration = 2
      this.selectedTimeSlot = null
      this.timeSlots = []
      this.showBookingModal = true
      this.loadSlots(this.selectedTable.id, this.bookingDate, preferredSlotId)
    },

    onLoginSuccess() {
      this.showLoginModal = false
      if (this.pendingTable) {
        const snapshot = this.pendingTable
        this.pendingTable = null
        this.openBooking(snapshot)
      }
    },

    selectTimeSlot(slotId) {
      if (this.bookingLoading || this.slotsLoading) return
      const slot = this.timeSlots.find(s => s.id === slotId)
      if (!slot || !slot.available) return
      this.selectedTimeSlot = slotId
    },

    onBookingModalToggle(open) {
      // 提交中禁止关闭，防止结果与弹窗状态错位
      if (!open && this.bookingLoading) return
      if (!open) {
        // 关闭即作废旧的时段响应，防止重新打开时闪现旧数据
        this.slotsRequestSeq++
        this.slotsLoading = false
      }
      this.showBookingModal = open
    },

    async confirmBooking() {
      // 重入保护：加载中/数据不完整直接拒绝（双重点击只会提交一次）
      if (this.bookingLoading || !this.canConfirmBooking) return

      // 提交瞬间冻结本次预约上下文，之后任何响应都不能再改变它
      const ctx = {
        table: { ...this.selectedTable },
        date: this.bookingDate,
        slot: { ...this.selectedSlot },
        duration: this.duration
      }
      this.bookingLoading = true

      try {
        const result = await api.bookTable({
          tableId: ctx.table.id,
          date: ctx.date,
          slotId: ctx.slot.id,
          timeSlot: ctx.slot.time,
          duration: ctx.duration
        })

        // 理论上弹窗此时无法关闭，但仍以快照为准，防止关闭后回调写状态
        if (!this.showBookingModal) return

        if (!result.success) {
          this.showNotification('error', '预约失败', result.error || '请稍后重试')
          // 时段可能已被别人占用，重新拉取后再允许操作
          await this.loadSlots(ctx.table.id, ctx.date)
          return
        }

        const res = result.data
        // 成功弹窗、任务中心、价格全部取自这一次响应（服务端回传的快照）
        this.bookingResult = {
          orderNo: res.orderNo,
          tableName: res.tableName,
          date: res.date,
          time: res.time
        }
        this.successMessage = `${res.date} ${res.time}`

        this.showBookingModal = false
        this.showSuccessModal = true
        this.showNotification(
          'info',
          '已添加到任务中心',
          '您可以在任务中心查看并管理此预约'
        )

        // 静默刷新当天列表，让新预约立即反映为占用（不闪 loading 遮罩）
        await this.loadTables(true)
      } catch (e) {
        if (this.showBookingModal) {
          this.showNotification('error', '预约失败', '网络异常，请稍后重试')
        }
      } finally {
        this.bookingLoading = false
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

.date-input input::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}

.time-slots {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.time-slots.loading {
  position: relative;
  min-height: 120px;
}

.slots-loading {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.loading-spinner.small {
  width: 22px;
  height: 22px;
  border-width: 2px;
}

.time-slot:disabled {
  cursor: not-allowed;
}

.duration-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.duration-btn:hover {
  border-color: var(--primary);
}

.duration-btn.active {
  background: rgba(0, 217, 165, 0.1);
  border-color: var(--primary);
  color: var(--primary);
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
