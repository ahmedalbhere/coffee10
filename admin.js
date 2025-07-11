const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// عناصر واجهة المستخدم
const loginSection = document.getElementById('login-section');
const adminPanel = document.getElementById('admin-panel');
const ordersContainer = document.getElementById('orders');
const menuListContainer = document.getElementById('menu-list');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('admin-year').textContent = new Date().getFullYear();
  adminPanel.style.display = 'none';
  loginSection.style.display = 'block';
  
  // التحقق من حالة المصادقة
  auth.onAuthStateChanged(user => {
    if (user) {
      checkAdminStatus(user.uid);
    } else {
      loginSection.style.display = 'block';
      adminPanel.style.display = 'none';
    }
  });

  // إضافة أحداث النماذج
  if (loginForm) {
    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      login();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});

// التحقق من صلاحية المسؤول
function checkAdminStatus(uid) {
  db.ref(`admins/${uid}`).once('value')
    .then(snapshot => {
      if (snapshot.exists()) {
        loginSection.style.display = 'none';
        adminPanel.style.display = 'block';
        loadData();
        startSessionTimer();
      } else {
        auth.signOut();
        alert("ليس لديك صلاحيات الدخول كلوحة تحكم");
      }
    })
    .catch(error => {
      console.error("Error checking admin status:", error);
      alert("حدث خطأ أثناء التحقق من الصلاحيات");
    });
}

// تسجيل الدخول
function login() {
  const email = document.getElementById('admin-email').value;
  const password = document.getElementById('admin-pass').value;
  
  if (!email || !password) {
    alert("الرجاء إدخال البريد الإلكتروني وكلمة المرور");
    return;
  }

  showLoading(true);
  
  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      // يتم التحقق من الصلاحيات في onAuthStateChanged
    })
    .catch(error => {
      showLoading(false);
      handleLoginError(error);
    });
}

// معالجة أخطاء تسجيل الدخول
function handleLoginError(error) {
  let errorMessage = "حدث خطأ أثناء تسجيل الدخول";
  
  switch (error.code) {
    case 'auth/invalid-email':
      errorMessage = "بريد إلكتروني غير صالح";
      break;
    case 'auth/user-disabled':
      errorMessage = "هذا الحساب معطل";
      break;
    case 'auth/user-not-found':
      errorMessage = "لا يوجد حساب بهذا البريد الإلكتروني";
      break;
    case 'auth/wrong-password':
      errorMessage = "كلمة المرور غير صحيحة";
      break;
    case 'auth/too-many-requests':
      errorMessage = "تم تجاوز عدد المحاولات المسموح بها، يرجى المحاولة لاحقاً";
      break;
  }
  
  alert(errorMessage);
  document.getElementById('admin-pass').value = '';
}

// تسجيل الخروج
function logout() {
  if (confirm("هل تريد تسجيل الخروج من لوحة التحكم؟")) {
    showLoading(true);
    auth.signOut()
      .then(() => {
        window.location.reload();
      })
      .catch(error => {
        console.error("Logout error:", error);
        alert("حدث خطأ أثناء تسجيل الخروج");
      });
  }
}

// مؤقت الجلسة (30 دقيقة)
function startSessionTimer() {
  let timer;
  const timeoutDuration = 30 * 60 * 1000; // 30 دقيقة
  
  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      auth.signOut().then(() => {
        alert("انتهت جلستك بسبب عدم النشاط، يرجى تسجيل الدخول مرة أخرى");
      });
    }, timeoutDuration);
  };
  
  // إعادة تعيين المؤقت عند أي نشاط
  window.onload = resetTimer;
  window.onmousemove = resetTimer;
  window.onmousedown = resetTimer;
  window.ontouchstart = resetTimer;
  window.onclick = resetTimer;
  window.onkeypress = resetTimer;
}

// تحميل البيانات
function loadData() {
  loadOrders();
  loadMenuList();
  logAdminActivity("الدخول إلى لوحة التحكم");
}

// تحميل الطلبات مع إمكانية التصفية
function loadOrders(filter = 'all') {
  showLoading(true, ordersContainer);
  
  db.ref("orders").orderByChild("timestamp").on("value", snapshot => {
    ordersContainer.innerHTML = '';
    const orders = snapshot.val();
    
    if (!orders) {
      showEmptyState(ordersContainer, "لا توجد طلبات حالياً", "fa-clipboard");
      showLoading(false);
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
      const message = filter === 'pending' ? 'قيد الانتظار' : 'مكتملة';
      showEmptyState(ordersContainer, `لا توجد طلبات ${message}`, "fa-clipboard");
    }
    
    showLoading(false);
  }, error => {
    console.error("Error loading orders:", error);
    showLoading(false);
    alert("حدث خطأ أثناء تحميل الطلبات");
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
  showLoading(true, menuListContainer);
  
  db.ref("menu").on("value", snapshot => {
    menuListContainer.innerHTML = '';
    const items = snapshot.val();
    
    if (!items) {
      showEmptyState(menuListContainer, "لا توجد أصناف في القائمة", "fa-utensils");
      showLoading(false);
      return;
    }
    
    for (const [key, item] of Object.entries(items)) {
      const itemElement = createMenuItemElement(key, item);
      menuListContainer.appendChild(itemElement);
    }
    
    showLoading(false);
  }, error => {
    console.error("Error loading menu:", error);
    showLoading(false);
    alert("حدث خطأ أثناء تحميل القائمة");
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
  
  showLoading(true);
  
  db.ref("menu").push({
    name: name,
    price: parseFloat(price).toFixed(2),
    createdBy: auth.currentUser.uid,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  }).then(() => {
    document.getElementById('newItem').value = '';
    document.getElementById('newPrice').value = '';
    document.getElementById('newItem').focus();
    logAdminActivity(`إضافة صنف جديد: ${name}`);
  }).catch(error => {
    console.error("Error adding menu item:", error);
    alert("حدث خطأ أثناء إضافة الصنف");
  }).finally(() => {
    showLoading(false);
  });
}

// تمييز الطلب كمكتمل
function completeOrder(orderId) {
  if (confirm("هل تريد تمييز هذا الطلب كمكتمل؟")) {
    showLoading(true);
    
    db.ref(`orders/${orderId}`).update({
      status: "completed",
      completedBy: auth.currentUser.uid,
      completedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
      logAdminActivity(`تمييز الطلب #${orderId.substring(0, 6)} كمكتمل`);
    }).catch(error => {
      console.error("Error completing order:", error);
      alert("حدث خطأ أثناء تحديث حالة الطلب");
    }).finally(() => {
      showLoading(false);
    });
  }
}

// حذف الطلب
function deleteOrder(orderId) {
  if (confirm("هل أنت متأكد من حذف هذا الطلب؟")) {
    showLoading(true);
    
    db.ref(`orders/${orderId}`).remove()
      .then(() => {
        logAdminActivity(`حذف الطلب #${orderId.substring(0, 6)}`);
      })
      .catch(error => {
        console.error("Error deleting order:", error);
        alert("حدث خطأ أثناء حذف الطلب");
      })
      .finally(() => {
        showLoading(false);
      });
  }
}

// حذف جميع الطلبات المكتملة
function clearCompleted() {
  if (confirm("هل تريد حذف جميع الطلبات المكتملة؟ هذا الإجراء لا يمكن التراجع عنه.")) {
    showLoading(true);
    
    db.ref("orders").once("value").then(snapshot => {
      const orders = snapshot.val();
      const updates = {};
      let count = 0;
      
      for (const [key, order] of Object.entries(orders)) {
        if (order.status === "completed") {
          updates[key] = null;
          count++;
        }
      }
      
      if (count === 0) {
        alert("لا توجد طلبات مكتملة للحذف");
        showLoading(false);
        return;
      }
      
      db.ref("orders").update(updates)
        .then(() => {
          logAdminActivity(`حذف ${count} طلبات مكتملة`);
          alert(`تم حذف ${count} طلبات مكتملة`);
        })
        .catch(error => {
          console.error("Error deleting completed orders:", error);
          alert("حدث خطأ أثناء حذف الطلبات المكتملة");
        })
        .finally(() => {
          showLoading(false);
        });
    });
  }
}

// حذف صنف من القائمة
function deleteMenuItem(itemId) {
  if (confirm("هل أنت متأكد من حذف هذا الصنف من القائمة؟")) {
    showLoading(true);
    
    db.ref(`menu/${itemId}`).remove()
      .then(() => {
        logAdminActivity("حذف صنف من القائمة");
      })
      .catch(error => {
        console.error("Error deleting menu item:", error);
        alert("حدث خطأ أثناء حذف الصنف");
      })
      .finally(() => {
        showLoading(false);
      });
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
  logAdminActivity(`تصفية الطلبات حسب: ${type}`);
}

// تسجيل أنشطة المسؤول
function logAdminActivity(action) {
  if (!auth.currentUser) return;
  
  db.ref("adminLogs").push({
    action: action,
    adminId: auth.currentUser.uid,
    adminEmail: auth.currentUser.email,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  }).catch(error => {
    console.error("Error logging admin activity:", error);
  });
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

// عرض حالة التحميل
function showLoading(show, container = null) {
  const target = container || document.body;
  const loadingElement = target.querySelector('.loading-overlay');
  
  if (show) {
    if (!loadingElement) {
      const overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
          <p>جاري التحميل...</p>
        </div>
      `;
      target.appendChild(overlay);
    }
  } else {
    if (loadingElement) {
      loadingElement.remove();
    }
  }
}

// عرض حالة فارغة
function showEmptyState(container, message, icon) {
  container.innerHTML = `
    <div class="empty-state">
      <i class="fas ${icon}"></i>
      <p>${message}</p>
    </div>
  `;
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
