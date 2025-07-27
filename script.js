// ... (بقية الإعدادات والمتغيرات كما هي)

async function initializeScanner() {
  if (isScannerActive) return;
  
  if (html5QrCode && html5QrCode.isScanning) {
    await html5QrCode.stop().catch(console.error);
  }

  html5QrCode = new Html5Qrcode("scanner");
  
  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    formatsToSupport: [
      // ... (تنسيقات الباركود المدعومة)
    ]
  };

  try {
    const devices = await Html5Qrcode.getCameras();
    if (devices && devices.length) {
      let cameraId;
      
      // محاولة العثور على الكاميرا الخلفية أولاً
      const backCamera = await findBackCamera(devices);
      
      if (backCamera) {
        cameraId = backCamera.id;
      } else if (devices.length === 1) {
        // إذا كان هناك كاميرا واحدة فقط
        cameraId = devices[0].id;
      } else {
        // عرض خيارات اختيار الكاميرا يدوياً
        cameraId = await showCameraSelection(devices);
      }

      currentCameraId = cameraId;
      
      await html5QrCode.start(
        currentCameraId,
        config,
        handleScanSuccess,
        handleScanError
      );
      
      isScannerActive = true;
      setupFlashButton();
    } else {
      throw new Error("No cameras found");
    }
  } catch (error) {
    console.error("Scanner initialization error:", error);
    handleScanError(error);
    switchToManualMode();
  }
}

// عرض واجهة اختيار الكاميرا
async function showCameraSelection(devices) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    modal.style.zIndex = '1000';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.color = 'white';
    
    modal.innerHTML = `
      <h2 style="margin-bottom: 20px;">اختر الكاميرا</h2>
      <div id="camera-options" style="margin-bottom: 20px;"></div>
      <button id="cancel-camera-selection" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 5px;">
        إلغاء والعودة للوضع اليدوي
      </button>
    `;
    
    const cameraOptions = document.createElement('div');
    cameraOptions.id = 'camera-options';
    
    devices.forEach(device => {
      const btn = document.createElement('button');
      btn.style.padding = '10px 20px';
      btn.style.margin = '5px';
      btn.style.background = '#4CAF50';
      btn.style.color = 'white';
      btn.style.border = 'none';
      btn.style.borderRadius = '5px';
      btn.textContent = device.label || `كاميرا ${device.id}`;
      btn.onclick = () => {
        document.body.removeChild(modal);
        resolve(device.id);
      };
      cameraOptions.appendChild(btn);
    });
    
    modal.appendChild(cameraOptions);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancel-camera-selection';
    cancelBtn.textContent = 'إلغاء والعودة للوضع اليدوي';
    cancelBtn.onclick = () => {
      document.body.removeChild(modal);
      switchToManualMode();
      resolve(null);
    };
    modal.appendChild(cancelBtn);
    
    document.body.appendChild(modal);
  });
}

// ... (بقية الدوال تبقى كما هي)
