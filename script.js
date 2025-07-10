const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let scanner = null;

// تهيئة السنة في التذييل
document.getElementById('year').textContent = new Date().getFullYear();

// تهيئة ماسح الباركود مع التحسينات
function initializeScanner() {
  // تنظيف أي ماسح موجود مسبقاً
  if (scanner) {
    scanner.clear().catch(error => {
      console.error("خطأ في تنظيف الماسح السابق:", error);
    });
  }

  scanner = new Html5QrcodeScanner("scanner", {
    fps: 10,
    qrbox: 250,
    aspectRatio: 1.0,
    disableFlip: false,
    rememberLastUsedCamera: true
  });

  scanner.render(
    (tableNumber) => {
      handleTableScanned(tableNumber);
    },
    (error) => {
      console.error("خطأ في المسح:", error);
      document.querySelector('.fallback-input').style.display = 'block';
      // إيقاف الماسح عند الخطأ
      if (scanner) {
        scanner.clear().catch(e => console.error("خطأ في إيقاف الماسح:", e));
      }
    }
  );
}

function handleTableScanned(tableNumber) {
  if (!tableNumber || isNaN(tableNumber)) {
    alert("باركود غير صالح، الرجاء المحاولة مرة أخرى");
    return;
  }
  
  // إيقاف الماسح الضوئي أولاً
  if (scanner) {
    scanner.clear().then(() => {
      console.log("تم إيقاف الماسح بنجاح");
      scanner = null;
      
      currentTable = tableNumber;
      document.getElementById('table-input').style.display = 'none';
      document.getElementById('menu').style.display = 'block';
      document.getElementById('scanned-table-number').textContent = tableNumber;
      loadMenu();
    }).catch(error => {
      console.error("خطأ في إيقاف الماسح:", error);
    });
  } else {
    currentTable = tableNumber;
    document.getElementById('table-input').style.display = 'none';
    document.getElementById('menu').style.display = 'block';
    document.getElementById('scanned-table-number').textContent = tableNumber;
    loadMenu();
  }
}

function enterTableManually() {
  const table = document.getElementById('tableNumber').value;
  if (table) {
    handleTableScanned(table);
  } else {
    alert("الرجاء إدخال رقم الطاولة");
  }
}

function loadMenu() {
  db.ref("menu").on("value", snapshot => {
    const itemsDiv = document.getElementById('menu-items');
    itemsDiv.innerHTML = '';
    const items = snapshot.val();
    
    if (!items || Object.keys(items).length === 0) {
      itemsDiv.innerHTML = `
        <div class="empty-menu">
          <i class="fas fa-utensils"></i>
          <p>لا توجد أصناف متاحة حالياً</p>
        </div>
      `;
      return;
    }
    
    // استخدام DocumentFragment لتحسين الأداء
    const fragment = document.createDocumentFragment();
    
    for (let key in items) {
      const item = items[key];
      const itemElement = document.createElement('div');
      itemElement.className = 'menu-item';
      itemElement.innerHTML = `
        <div class="item-info">
          <h3>${item.name}</h3>
          <div class="item-price">${item.price} جنيه</div>
        </div>
        <div class="item-controls">
          <div class="quantity-selector">
            <button class="qty-btn minus-btn">
              <i class="fas fa-minus"></i>
            </button>
            <span class="qty-value">0</span>
            <button class="qty-btn plus-btn">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          <textarea class="item-note" placeholder="ملاحظات خاصة"></textarea>
        </div>
      `;
      fragment.appendChild(itemElement);
    }
    
    itemsDiv.appendChild(fragment);
    
    // استخدام event delegation للتحكم في الكميات
    itemsDiv.addEventListener('click', function(e) {
      const target = e.target;
      const qtyElement = target.closest('.quantity-selector')?.querySelector('.qty-value');
      
      if (!qtyElement) return;
      
      if (target.classList.contains('minus-btn') || target.closest('.minus-btn')) {
        let currentQty = parseInt(qtyElement.textContent) || 0;
        if (currentQty > 0) {
          qtyElement.textContent = currentQty - 1;
        }
      }
      
      if (target.classList.contains('plus-btn') || target.closest('.plus-btn')) {
        let currentQty = parseInt(qtyElement.textContent) || 0;
        qtyElement.textContent = currentQty + 1;
      }
    });
  });
}

function submitOrder() {
  const order = { 
    table: currentTable, 
    items: [],
    status: "pending",
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };
  
  db.ref("menu").once("value").then(snapshot => {
    const items = snapshot.val();
    let hasItems = false;
    
    document.querySelectorAll('.menu-item').forEach((itemElement, index) => {
      const qtyElement = itemElement.querySelector('.qty-value');
      const noteElement = itemElement.querySelector('.item-note');
      const qty = parseInt(qtyElement.textContent) || 0;
      const note = noteElement.value;
      
      if (qty > 0) {
        hasItems = true;
        const itemName = itemElement.querySelector('.item-info h3').textContent;
        const itemPrice = parseFloat(itemElement.querySelector('.item-price').textContent);
        
        order.items.push({
          name: itemName,
          price: itemPrice,
          qty: qty,
          note: note
        });
      }
    });
    
    if (!hasItems) {
      alert("الرجاء إضافة كمية لعنصر واحد على الأقل");
      return;
    }
    
    db.ref("orders").push(order);
    showOrderSummary(order);
  });
}

function showOrderSummary(order) {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('summary-table').textContent = order.table;
  
  const itemsDiv = document.getElementById('summary-items');
  itemsDiv.innerHTML = '<strong>تفاصيل الطلب:</strong><br><br>';
  
  let total = 0;
  order.items.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    itemsDiv.innerHTML += `
      <div class="summary-item">
        ${item.qty} × ${item.name} - ${itemTotal.toFixed(2)} جنيه
        ${item.note ? `<div class="summary-note">ملاحظات: ${item.note}</div>` : ''}
      </div>
    `;
  });
  
  itemsDiv.innerHTML += `<br><div class="summary-total">المجموع: ${total.toFixed(2)} جنيه</div>`;
  
  document.getElementById('order-summary').style.display = 'block';
}

function goBack() {
  if (scanner) {
    scanner.clear().then(() => {
      scanner = null;
      document.getElementById('menu').style.display = 'none';
      document.getElementById('table-input').style.display = 'block';
      document.querySelector('.fallback-input').style.display = 'none';
      currentTable = null;
      initializeScanner();
    }).catch(error => {
      console.error("خطأ في إيقاف الماسح:", error);
    });
  } else {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('table-input').style.display = 'block';
    document.querySelector('.fallback-input').style.display = 'none';
    currentTable = null;
    initializeScanner();
  }
}

function newOrder() {
  document.getElementById('order-summary').style.display = 'none';
  document.getElementById('table-input').style.display = 'block';
  currentTable = null;
  
  // تنظيف الماسح السابق إن وجد
  if (scanner) {
    scanner.clear().catch(error => {
      console.error("خطأ في تنظيف الماسح:", error);
    });
  }
  
  initializeScanner();
}

// تهيئة الماسح عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', initializeScanner);
