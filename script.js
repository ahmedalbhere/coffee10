const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// عناصر واجهة المستخدم
const loginSection = document.getElementById('login-section');
const adminPanel = document.getElementById('admin-panel');
const ordersContainer = document.getElementById('orders');
const menuListContainer = document.getElementById('menu-list');

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('admin-year').textContent = new Date().getFullYear();
  adminPanel.style.display = 'none';
  
  // التحقق من تسجيل الدخول السابق
  if (localStorage.getItem('adminLoggedIn') === 'true') {
    loginSection.style.display = 'none';
    adminPanel.style.display = 'block';
    loadData();
  }
});

// تسجيل الدخول
function login() {
  const pass = document.getElementById('admin-pass').value;
  
  if (pass === "4321") {
    loginSection.style.display = 'none';
    adminPanel.style.display = 'block';
    localStorage.setItem('adminLoggedIn', 'true');
    loadData();
  } else {
    alert("كلمة المرور غير صحيحة");
    document.getElementById('admin-pass').value = '';
  }
}

// تسجيل الخروج
function logout() {
  if (confirm("هل تريد تسجيل الخروج من لوحة التحكم؟")) {
    localStorage.removeItem('adminLoggedIn');
    loginSection.style.display = 'block';
    adminPanel.style.display = 'none';
  }
}

// تحميل البيانات
function loadData() {
  loadOrders();
  loadMenuList();
}

// تحميل الطلبات مع إمكانية التصفية
function loadOrders(filter = 'all') {
  db.ref("orders").orderByChild("timestamp").on("value", snapshot => {
    ordersContainer.innerHTML = '';
    const orders = snapshot.val();
    
    if (!orders) {
      ordersContainer.innerHTML = `
        <div class="empty-orders">
          <i class="fas fa-clipboard"></i>
          <p>لا توجد طلبات حالياً</p>
        </div>
      `;
      return;
    }
    
    const ordersArray = Object.entries(orders).reverse();
    let hasOrders = false;
    
    ordersArray.forEach(([key, order]) => {
      if (filter === 'all' || 
          (filter === 'pending' && order.status !== 'completed') || 
          (filter === 'completed' && order.status === 'completed')) {
        
        hasOrders = true;
        const orderElement = createOrderElement(key, order);
        ordersContainer.appendChild(orderElement);
      }
    });
    
    if (!hasOrders) {
      ordersContainer.innerHTML = `
        <div class="empty-orders">
          <i class="fas fa-clipboard"></i>
          <p>لا توجد طلبات ${filter === 'pending' ? 'قيد الانتظار' : 'مكتملة'}</p>
        </div>
      `;
    }
  });
}

// إنشاء عنصر طلب
function createOrderElement(key, order) {
  const orderElement = document.createElement('div');
  orderElement.className = `order-card ${order.status === 'completed' ? 'completed' : 'pending'}`;
  
  let itemsHTML = '';
  let total = 0;
  
  order.items.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    
    itemsHTML += `
      <div class="order-item">
        <div class="item-name">${item.name}</div>
        <div class="item-details">
          <span class="item-qty">${item.qty} ×</span>
          <span class="item-price">${item.price} ج</span>
          <span class="item-total">${itemTotal.toFixed(2)} ج</span>
        </div>
        ${item.note ? `<div class="item-note">${item.note}</div>` : ''}
      </div>
    `;
  });
  
  orderElement.innerHTML = `
    <div class="order-header">
      <div class="order-meta">
        <span class="order-id">#${key.substring(0, 6)}</span>
        <span class="order-status ${order.status === 'completed' ? 'completed' : 'pending'}">
          ${order.status === 'completed' ? 'مكتمل' : 'قيد الانتظار'}
        </span>
      </div>
      <div class="order-title">
        <i class="fas fa-table"></i> الطاولة: ${order.table}
      </div>
      <div class="order-time">${formatTime(order.timestamp)}</div>
    </div>
    
    <div class="order-items">${itemsHTML}</div>
    
    <div class="order-footer">
      <div class="order-total">المجموع: ${total.toFixed(2)} جنيه</div>
      <div class="order-actions">
        ${order.status !== 'completed' ? `
          <button onclick="completeOrder('${key}')" class="btn-complete">
            <i class="fas fa-check"></i> تم الانتهاء
          </button>
        ` : ''}
        <button onclick="deleteOrder('${key}')" class="btn-delete">
          <i class="fas fa-trash"></i> حذف
        </button>
      </div>
    </div>
  `;
  
  return orderElement;
}

// تحميل قائمة الطعام
function loadMenuList() {
  db.ref("menu").on("value", snapshot => {
    menuListContainer.innerHTML = '';
    const items = snapshot.val();
    
    if (!items) {
      menuListContainer.innerHTML = `
        <div class="empty-menu">
          <i class="fas fa-utensils"></i>
          <p>لا توجد أصناف في القائمة</p>
        </div>
      `;
      return;
    }
    
    for (const [key, item] of Object.entries(items)) {
      const itemElement = createMenuItemElement(key, item);
      menuListContainer.appendChild(itemElement);
    }
  });
}

// إنشاء عنصر قائمة طعام
function createMenuItemElement(key, item) {
  const itemElement = document.createElement('div');
  itemElement.className = 'menu-item';
  
  itemElement.innerHTML = `
    <div class="menu-item-info">
      <div class="item-name">${item.name}</div>
      <div class="item-price">${item.price} جنيه</div>
    </div>
    <button onclick="deleteMenuItem('${key}')" class="btn-delete">
      <i class="fas fa-trash"></i>
    </button>
  `;
  
  return itemElement;
}

// إضافة صنف جديد
function addMenuItem() {
  const name = document.getElementById('newItem').value.trim();
  const price = document.getElementById('newPrice').value;
  
  if (!name || !price) {
    alert("الرجاء إدخال اسم الصنف والسعر");
    return;
  }
  
  if (isNaN(price) || parseFloat(price) <= 0) {
    alert("السعر يجب أن يكون رقماً موجباً");
    return;
  }
  
  db.ref("menu").push({
    name: name,
    price: parseFloat(price).toFixed(2)
  }).then(() => {
    document.getElementById('newItem').value = '';
    document.getElementById('newPrice').value = '';
    document.getElementById('newItem').focus();
  });
}

// تمييز الطلب كمكتمل
function completeOrder(orderId) {
  if (confirm("هل تريد تمييز هذا الطلب كمكتمل؟")) {
    db.ref(`orders/${orderId}`).update({
      status: "completed",
      completedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }
}

// حذف الطلب
function deleteOrder(orderId) {
  if (confirm("هل أنت متأكد من حذف هذا الطلب؟")) {
    db.ref(`orders/${orderId}`).remove();
  }
}

// حذف جميع الطلبات المكتملة
function clearCompleted() {
  if (confirm("هل تريد حذف جميع الطلبات المكتملة؟ هذا الإجراء لا يمكن التراجع عنه.")) {
    db.ref("orders").once("value").then(snapshot => {
      const orders = snapshot.val();
      const updates = {};
      
      for (const [key, order] of Object.entries(orders)) {
        if (order.status === "completed") {
          updates[key] = null;
        }
      }
      
      db.ref("orders").update(updates);
    });
  }
}

// حذف صنف من القائمة
function deleteMenuItem(itemId) {
  if (confirm("هل أنت متأكد من حذف هذا الصنف من القائمة؟")) {
    db.ref(`menu/${itemId}`).remove();
  }
}

// تصفية الطلبات
function filterOrders(type) {
  // تحديث واجهة التصفية
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // تحميل الطلبات المصفاة
  loadOrders(type);
}

// تنسيق الوقت
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// تصدير الدوال للوصول إليها من HTML
window.login = login;
window.logout = logout;
window.addMenuItem = addMenuItem;
window.deleteMenuItem = deleteMenuItem;
window.deleteOrder = deleteOrder;
window.completeOrder = completeOrder;
window.filterOrders = filterOrders;
window.clearCompleted = clearCompleted;
