const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let scanner = null;
let isScannerActive = false;

// Set current year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Initialize QR Scanner
function initializeScanner() {
  if (isScannerActive) return;
  
  try {
    scanner = new Html5QrcodeScanner("scanner", {
      fps: 10,
      qrbox: 250,
      aspectRatio: 1.0,
      disableFlip: false
    });

    const successCallback = (decodedText) => {
      isScannerActive = false;
      scanner.clear().then(() => {
        console.log("QR Scanner stopped successfully");
        handleTableScanned(decodedText);
      }).catch(err => {
        console.error("Failed to stop scanner", err);
        handleTableScanned(decodedText);
      });
    };

    const errorCallback = (error) => {
      console.error("QR Scanner error:", error);
      document.querySelector('.fallback-input').style.display = 'block';
    };

    scanner.render(successCallback, errorCallback);
    isScannerActive = true;
  } catch (error) {
    console.error("Scanner initialization error:", error);
    document.querySelector('.fallback-input').style.display = 'block';
  }
}

function handleTableScanned(tableNumber) {
  // Validate table number
  tableNumber = tableNumber.trim();
  if (!tableNumber || isNaN(tableNumber)) {
    alert("الرجاء مسح باركود صالح أو إدخال رقم طاولة صحيح");
    return;
  }

  currentTable = tableNumber;
  document.getElementById('table-input').style.display = 'none';
  document.getElementById('menu').style.display = 'block';
  document.getElementById('scanned-table-number').textContent = tableNumber;
  
  loadMenu();
}

function enterTableManually() {
  const tableInput = document.getElementById('tableNumber');
  const tableNumber = tableInput.value.trim();
  
  if (!tableNumber || isNaN(tableNumber)) {
    alert("الرجاء إدخال رقم طاولة صحيح");
    tableInput.focus();
    return;
  }
  
  handleTableScanned(tableNumber);
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
      const itemElement = document.createElement('div');
      itemElement.className = 'menu-item';
      itemElement.innerHTML = `
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
          <textarea id="note-${key}" class="item-note" placeholder="ملاحظات خاصة"></textarea>
        </div>
      `;
      itemsDiv.appendChild(itemElement);
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
  if (!currentTable) {
    alert("الرجاء تحديد رقم الطاولة أولاً");
    return;
  }

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
      const note = document.getElementById(`note-${key}`).value.trim();
      if (qty > 0) {
        hasItems = true;
        order.items.push({
          name: items[key].name,
          price: parseFloat(items[key].price),
          qty: qty,
          note: note
        });
      }
    }
    
    if (!hasItems) {
      alert("الرجاء إضافة كمية لعنصر واحد على الأقل");
      return;
    }
    
    db.ref("orders").push(order)
      .then(() => {
        showOrderSummary(order);
      })
      .catch(error => {
        console.error("Error submitting order:", error);
        alert("حدث خطأ أثناء إرسال الطلب، الرجاء المحاولة مرة أخرى");
      });
  });
}

function showOrderSummary(order) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  document.getElementById('menu').style.display = 'none';
  document.getElementById('table-input').style.display = 'block';
  document.querySelector('.fallback-input').style.display = 'none';
  currentTable = null;
  
  if (scanner) {
    scanner.clear().catch(error => {
      console.error("Failed to clear scanner", error);
    });
    scanner = null;
  }
  isScannerActive = false;
  initializeScanner();
}

function newOrder() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  document.getElementById('order-summary').style.display = 'none';
  document.getElementById('table-input').style.display = 'block';
  currentTable = null;
  
  if (scanner) {
    scanner.clear().catch(error => {
      console.error("Failed to clear scanner", error);
    });
    scanner = null;
  }
  isScannerActive = false;
  initializeScanner();
}

// Initialize scanner when page loads
document.addEventListener('DOMContentLoaded', () => {
  initializeScanner();
  
  // Add event listener for manual table input
  document.getElementById('tableNumber').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      enterTableManually();
    }
  });
});

// Export functions to global scope
window.enterTableManually = enterTableManually;
window.incrementQuantity = incrementQuantity;
window.decrementQuantity = decrementQuantity;
window.submitOrder = submitOrder;
window.goBack = goBack;
window.newOrder = newOrder;
