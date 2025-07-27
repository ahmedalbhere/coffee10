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
    checkAdminPassword().then(isAuthenticated => {
      if (isAuthenticated) {
        loginSection.style.display = 'none';
        adminPanel.style.display = 'block';
        loadData();
      } else {
        localStorage.removeItem('adminLoggedIn');
      }
    });
  }
});

// التحقق من كلمة مرور المسؤول
async function checkAdminPassword() {
  try {
    const snapshot = await db.ref("admin/password").once("value");
    const savedPass = snapshot.val();
    const sessionPass = sessionStorage.getItem('adminTempPass');
    
    // إذا لم تكن هناك كلمة مرور محفوظة، استخدم الافتراضية "4321"
    if (!savedPass && sessionPass === "4321") return true;
    if (savedPass === sessionPass) return true;
    
    return false;
  } catch (error) {
    console.error("Error checking password:", error);
    return false;
  }
}

// تسجيل الدخول
async function login() {
  const pass = document.getElementById('admin-pass').value.trim();
  
  if (!pass) {
    alert("الرجاء إدخال كلمة المرور");
    return;
  }

  try {
    const snapshot = await db.ref("admin/password").once("value");
    const savedPass = snapshot.val() || "4321"; // القيمة الافتراضية
    
    if (pass === savedPass) {
      // تخزين مؤقت في sessionStorage (أكثر أماناً من localStorage)
      sessionStorage.setItem('adminTempPass', pass);
      localStorage.setItem('adminLoggedIn', 'true');
      
      loginSection.style.display = 'none';
      adminPanel.style.display = 'block';
      loadData();
    } else {
      alert("كلمة المرور غير صحيحة");
      document.getElementById('admin-pass').value = '';
    }
  } catch (error) {
    console.error("Login error:", error);
    alert("حدث خطأ أثناء تسجيل الدخول");
  }
}

// تسجيل الخروج
function logout() {
  if (confirm("هل تريد تسجيل الخروج من لوحة التحكم؟")) {
    sessionStorage.removeItem('adminTempPass');
    localStorage.removeItem('adminLoggedIn');
    loginSection.style.display = 'block';
    adminPanel.style.display = 'none';
  }
}

// تغيير كلمة المرور
async function changePassword() {
  const currentPass = document.getElementById('current-pass').value.trim();
  const newPass = document.getElementById('new-pass').value.trim();
  const confirmPass = document.getElementById('confirm-pass').value.trim();
  
  if (!currentPass || !newPass || !confirmPass) {
    alert("الرجاء ملء جميع الحقول");
    return;
  }
  
  if (newPass.length < 4) {
    alert("كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل");
    return;
  }
  
  if (newPass !== confirmPass) {
    alert("كلمتا المرور الجديدتان غير متطابقتين");
    return;
  }

  try {
    const snapshot = await db.ref("admin/password").once("value");
    const savedPass = snapshot.val() || "4321"; // القيمة الافتراضية
    
    if (currentPass !== savedPass) {
      alert("كلمة المرور الحالية غير صحيحة");
      return;
    }
    
    await db.ref("admin").update({ password: newPass });
    
    // تحديث كلمة المرور في الجلسة الحالية
    sessionStorage.setItem('adminTempPass', newPass);
    
    // مسح الحقول وإظهار رسالة النجاح
    document.getElementById('current-pass').value = '';
    document.getElementById('new-pass').value = '';
    document.getElementById('confirm-pass').value = '';
    
    alert("تم تغيير كلمة المرور بنجاح");
  } catch (error) {
    console.error("Error changing password:", error);
    alert("حدث خطأ أثناء تغيير كلمة المرور");
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
async function addMenuItem() {
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
  
  try {
    await db.ref("menu").push({
      name: name,
      price: parseFloat(price).toFixed(2)
    });
    
    document.getElementById('newItem').value = '';
    document.getElementById('newPrice').value = '';
    document.getElementById('newItem').focus();
  } catch (error) {
    console.error("Error adding menu item:", error);
    alert("حدث خطأ أثناء إضافة الصنف");
  }
}

// تمييز الطلب كمكتمل
async function completeOrder(orderId) {
  if (confirm("هل تريد تمييز هذا الطلب كمكتمل؟")) {
    try {
      await db.ref(`orders/${orderId}`).update({
        status: "completed",
        completedAt: firebase.database.ServerValue.TIMESTAMP
      });
    } catch (error) {
      console.error("Error completing order:", error);
      alert("حدث خطأ أثناء تحديث حالة الطلب");
    }
  }
}

// حذف الطلب
async function deleteOrder(orderId) {
  if (confirm("هل أنت متأكد من حذف هذا الطلب؟")) {
    try {
      await db.ref(`orders/${orderId}`).remove();
    } catch (error) {
      console.error("Error deleting order:", error);
      alert("حدث خطأ أثناء حذف الطلب");
    }
  }
}

// حذف جميع الطلبات المكتملة
async function clearCompleted() {
  if (confirm("هل تريد حذف جميع الطلبات المكتملة؟ هذا الإجراء لا يمكن التراجع عنه.")) {
    try {
      const snapshot = await db.ref("orders").once("value");
      const orders = snapshot.val();
      const updates = {};
      
      for (const [key, order] of Object.entries(orders)) {
        if (order.status === "completed") {
          updates[key] = null;
        }
      }
      
      await db.ref("orders").update(updates);
    } catch (error) {
      console.error("Error clearing completed orders:", error);
      alert("حدث خطأ أثناء حذف الطلبات المكتملة");
    }
  }
}

// حذف صنف من القائمة
async function deleteMenuItem(itemId) {
  if (confirm("هل أنت متأكد من حذف هذا الصنف من القائمة؟")) {
    try {
      await db.ref(`menu/${itemId}`).remove();
    } catch (error) {
      console.error("Error deleting menu item:", error);
      alert("حدث خطأ أثناء حذف الصنف");
    }
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
window.changePassword = changePassword;
window.addMenuItem = addMenuItem;
window.deleteMenuItem = deleteMenuItem;
window.deleteOrder = deleteOrder;
window.completeOrder = completeOrder;
window.filterOrders = filterOrders;
window.clearCompleted = clearCompleted;
