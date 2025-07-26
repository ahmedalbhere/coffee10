
const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let scanner = null;
let isScannerActive = false;

// تهيئة السنة في التذييل
document.getElementById('year').textContent = new Date().getFullYear();

// تهيئة الماسح مع الكاميرا الخلفية مباشرة
async function initializeScanner() {
  if (isScannerActive) return;
  
  try {
    const html5QrCode = new Html5Qrcode("scanner");
    
    // دالة للعثور على الكاميرا الخلفية
    const getBackCamera = async () => {
      const devices = await Html5Qrcode.getCameras();
      for (const device of devices) {
        if (device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('rear')) {
          return device.id;
        }
      }
      // إذا لم نجد كاميرا خلفية، نستخدم آخر كاميرا (عادة تكون الخلفية في الأجهزة التي بها كاميرا واحدة)
      return devices[devices.length - 1].id;
    };
    
    const cameraId = await getBackCamera();
    
    await html5QrCode.start(
      cameraId,
      {
        fps: 10,
        qrbox: 250,
        aspectRatio: 1.0,
        disableFlip: false
      },
      (tableNumber) => {
        // نجاح المسح
        isScannerActive = false;
        html5QrCode.stop().then(() => {
          console.log("QR Scanner stopped successfully");
          handleTableScanned(tableNumber);
        }).catch(err => {
          console.error("Failed to stop scanner", err);
          handleTableScanned(tableNumber);
        });
      },
      (errorMessage) => {
        // خطأ في المسح
        console.error("QR Scanner error:", errorMessage);
        document.querySelector('.fallback-input').style.display = 'block';
      }
    );
    
    scanner = html5QrCode;
    isScannerActive = true;
  } catch (error) {
    console.error("Scanner initialization error:", error);
    document.querySelector('.fallback-input').style.display = 'block';
  }
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

    // إنشاء قسم المشروبات الساخنة
    const hotDiv = document.createElement('div');
    hotDiv.className = 'menu-section';
    hotDiv.innerHTML = '<h3 class="section-title"><i class="fas fa-mug-hot"></i> المشروبات الساخنة</h3>';
    const hotItemsContainer = document.createElement('div');
    hotItemsContainer.className = 'menu-items-container';
    hotDiv.appendChild(hotItemsContainer);

    // إنشاء قسم المشروبات الباردة
    const coldDiv = document.createElement('div');
    coldDiv.className = 'menu-section';
    coldDiv.innerHTML = '<h3 class="section-title"><i class="fas fa-glass-whiskey"></i> المشروبات الباردة</h3>';
    const coldItemsContainer = document.createElement('div');
    coldItemsContainer.className = 'menu-items-container';
    coldDiv.appendChild(coldItemsContainer);

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

      // تصنيف العناصر حسب النوع (ساخن/بارد)
      if (item.type === 'hot') {
        hotItemsContainer.appendChild(itemElement);
      } else if (item.type === 'cold') {
        coldItemsContainer.appendChild(itemElement);
      }
    }

    // إضافة الأقسام فقط إذا كانت تحتوي على عناصر
    if (hotItemsContainer.children.length > 0) {
      itemsDiv.appendChild(hotDiv);
    }
    if (coldItemsContainer.children.length > 0) {
      itemsDiv.appendChild(coldDiv);
    }

    // إظهار رسالة إذا لم يكن هناك عناصر
    if (hotItemsContainer.children.length === 0 && coldItemsContainer.children.length === 0) {
      itemsDiv.innerHTML = `
        <div class="empty-menu">
          <i class="fas fa-utensils"></i>
          <p>لا توجد أصناف متاحة حالياً</p>
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
          note: note,
          type: items[key].type // إضافة نوع الصنف للطلب
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
  document.getElementById('menu').style.display = 'none';
  document.getElementById('table-input').style.display = 'block';
  document.querySelector('.fallback-input').style.display = 'none';
  currentTable = null;
  
  if (scanner) {
    scanner.stop().then(() => {
      console.log("Scanner stopped successfully");
      scanner.clear();
      scanner = null;
      isScannerActive = false;
      initializeScanner();
    }).catch(error => {
      console.error("Failed to stop scanner", error);
      scanner.clear();
      scanner = null;
      isScannerActive = false;
      initializeScanner();
    });
  } else {
    initializeScanner();
  }
}

function newOrder() {
  document.getElementById('order-summary').style.display = 'none';
  document.getElementById('table-input').style.display = 'block';
  currentTable = null;
  
  if (scanner) {
    scanner.stop().then(() => {
      console.log("Scanner stopped successfully");
      scanner.clear();
      scanner = null;
      isScannerActive = false;
      initializeScanner();
    }).catch(error => {
      console.error("Failed to stop scanner", error);
      scanner.clear();
      scanner = null;
      isScannerActive = false;
      initializeScanner();
    });
  } else {
    initializeScanner();
  }
}

// تهيئة الماسح عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  initializeScanner();
  
  // إضافة حدث لزر الإدخال اليدوي
  document.getElementById('tableNumber').addEventListener('keypress', (e)
