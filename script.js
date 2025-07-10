const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let scanner = null;

// تهيئة السنة في التذييل
document.getElementById('year').textContent = new Date().getFullYear();

// تهيئة ماسح الباركود
function initializeScanner() {
  scanner = new Html5QrcodeScanner("scanner", {
    fps: 10,
    qrbox: 250,
    aspectRatio: 1.0,
    disableFlip: false
  });

  scanner.render(
    (tableNumber) => {
      handleTableScanned(tableNumber);
    },
    (error) => {
      console.error("خطأ في المسح:", error);
      document.querySelector('.fallback-input').style.display = 'block';
    }
  );
}

function handleTableScanned(tableNumber) {
  if (!tableNumber || isNaN(tableNumber)) {
    alert("باركود غير صالح، الرجاء المحاولة مرة أخرى");
    return;
  }
  
  currentTable = tableNumber;
  document.getElementById('table-input').style.display = 'none';
  document.getElementById('menu').style.display = 'block';
  document.getElementById('scanned-table-number').textContent = tableNumber;
  loadMenu();
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
    
    for (let key in items) {
      const item = items[key];
      itemsDiv.innerHTML += `
        <div class="menu-item">
          <div class="item-info">
            <h3>${item.name}</h3>
            <div class="item-price">${item.price} جنيه</div>
          </div>
          <div class="item-controls">
            <div class="quantity-selector">
              <button onclick="decrementQuantity('${key}')" class="qty-btn">
                <i class="fas fa-minus"></i>
              </button>
              <span id="qty-value-${key}" class="qty-value">0</span>
              <button onclick="incrementQuantity('${key}')" class="qty-btn">
                <i class="fas fa-plus"></i>
              </button>
            </div>
            <textarea id="note-${key}" placeholder="ملاحظات خاصة"></textarea>
          </div>
        </div>
      `;
    }
  });
}

function incrementQuantity(itemId) {
  const qtyElement = document.getElementById(`qty-value-${itemId}`);
  let currentQty = parseInt(qtyElement.textContent) || 0;
  qtyElement.textContent = currentQty + 1;
}

function decrementQuantity(itemId) {
  const qtyElement = document.getElementById(`qty-value-${itemId}`);
  let currentQty = parseInt(qtyElement.textContent) || 0;
  if (currentQty > 0) {
    qtyElement.textContent = currentQty - 1;
  }
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
    
    for (let key in items) {
      const qty = parseInt(document.getElementById(`qty-value-${key}`).textContent) || 0;
      const note = document.getElementById(`note-${key}`).value;
      if (qty > 0) {
        hasItems = true;
        order.items.push({
          name: items[key].name,
          price: items[key].price,
          qty: qty,
          note: note
        });
      }
    }
    
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
    scanner.clear().catch(error => console.error("Failed to clear scanner", error));
  }
  document.getElementById('menu').style.display = 'none';
  document.getElementById('table-input').style.display = 'block';
  document.querySelector('.fallback-input').style.display = 'none';
  currentTable = null;
  initializeScanner();
}

function newOrder() {
  document.getElementById('order-summary').style.display = 'none';
  document.getElementById('table-input').style.display = 'block';
  currentTable = null;
  initializeScanner();
}

// تهيئة الماسح عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', initializeScanner);
