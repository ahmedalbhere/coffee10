const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let scanner = null;

document.getElementById('year').textContent = new Date().getFullYear();

function initializeScanner() {
  if (scanner) {
    scanner.clear().catch(error => {
      console.error("Error cleaning scanner:", error);
    });
  }

  scanner = new Html5QrcodeScanner(
    "scanner",
    {
      fps: 30,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      disableFlip: false,
      rememberLastUsedCamera: true,
      showTorchButtonIfSupported: true
    },
    false
  );

  scanner.render(
    (decodedText) => {
      scanner.pause().then(() => {
        handleTableScanned(decodedText);
      });
    },
    (error) => {
      console.error("Scan error:", error);
      document.querySelector('.fallback-input').style.display = 'block';
    }
  );
}

function handleTableScanned(tableNumber) {
  if (!tableNumber || isNaN(tableNumber)) {
    alert("باركود غير صالح");
    return;
  }

  currentTable = tableNumber;
  document.getElementById('table-input').style.display = 'none';
  document.getElementById('menu').style.display = 'block';
  document.getElementById('scanned-table-number').textContent = tableNumber;
  loadMenu();
}

function loadMenu() {
  db.ref("menu").on("value", snapshot => {
    const itemsDiv = document.getElementById('menu-items');
    itemsDiv.innerHTML = '';
    const items = snapshot.val();
    
    if (!items) {
      itemsDiv.innerHTML = '<div class="empty-menu">لا توجد أصناف</div>';
      return;
    }
    
    const fragment = document.createDocumentFragment();
    
    for (let key in items) {
      const itemElement = document.createElement('div');
      itemElement.className = 'menu-item';
      itemElement.innerHTML = `
        <div class="item-info">
          <h3>${items[key].name}</h3>
          <div class="item-price">${items[key].price} جنيه</div>
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
          <textarea class="item-note" placeholder="ملاحظات"></textarea>
        </div>
      `;
      fragment.appendChild(itemElement);
    }
    
    itemsDiv.appendChild(fragment);
    
    itemsDiv.addEventListener('click', function(e) {
      const qtyElement = e.target.closest('.quantity-selector')?.querySelector('.qty-value');
      if (!qtyElement) return;
      
      if (e.target.classList.contains('minus-btn') || e.target.closest('.minus-btn')) {
        let currentQty = parseInt(qtyElement.textContent) || 0;
        if (currentQty > 0) qtyElement.textContent = currentQty - 1;
      }
      
      if (e.target.classList.contains('plus-btn') || e.target.closest('.plus-btn')) {
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
  
  document.querySelectorAll('.menu-item').forEach(item => {
    const qty = parseInt(item.querySelector('.qty-value').textContent) || 0;
    if (qty > 0) {
      order.items.push({
        name: item.querySelector('h3').textContent,
        price: parseFloat(item.querySelector('.item-price').textContent),
        qty: qty,
        note: item.querySelector('.item-note').value
      });
    }
  });
  
  if (order.items.length === 0) {
    alert("الرجاء إضافة عناصر للطلب");
    return;
  }
  
  db.ref("orders").push(order);
  showOrderSummary(order);
}

function showOrderSummary(order) {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('summary-table').textContent = order.table;
  
  let html = '<strong>تفاصيل الطلب:</strong><br><br>';
  let total = 0;
  
  order.items.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    html += `
      <div class="summary-item">
        ${item.qty} × ${item.name} - ${itemTotal.toFixed(2)} جنيه
        ${item.note ? `<div class="summary-note">${item.note}</div>` : ''}
      </div>
    `;
  });
  
  html += `<br><div class="summary-total">المجموع: ${total.toFixed(2)} جنيه</div>`;
  document.getElementById('summary-items').innerHTML = html;
  document.getElementById('order-summary').style.display = 'block';
}

function goBack() {
  if (scanner) {
    scanner.clear().then(() => {
      scanner = null;
      resetMenu();
    });
  } else {
    resetMenu();
  }
}

function resetMenu() {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('table-input').style.display = 'block';
  currentTable = null;
  initializeScanner();
}

function newOrder() {
  document.getElementById('order-summary').style.display = 'none';
  document.getElementById('table-input').style.display = 'block';
  currentTable = null;
  initializeScanner();
}

document.addEventListener('DOMContentLoaded', initializeScanner);
