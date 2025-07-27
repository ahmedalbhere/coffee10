// البحث عن الكاميرا الخلفية بشكل دقيق
function findBackCamera(devices) {
  // كلمات دالة أكثر شمولاً للكاميرا الخلفية
  const backKeywords = ['back', 'rear', 'environment', 'external', '1', 'primary', 'bck'];
  const frontKeywords = ['front', 'selfie', 'user', 'face', '0'];
  
  // البحث عن كاميرا محددة بخاصية facingMode
  const environmentCamera = devices.find(device => 
    device.label.toLowerCase().includes('environment')
  );
  
  if (environmentCamera) return environmentCamera;
  
  // البحث عن كاميرا تحتوي على كلمات خلفية
  const explicitBackCamera = devices.find(device => 
    backKeywords.some(keyword => device.label.toLowerCase().includes(keyword))
  );
  
  if (explicitBackCamera) return explicitBackCamera;
  
  // البحث عن كاميرا بدون كلمات أمامية
  const nonFrontCamera = devices.find(device => 
    !frontKeywords.some(keyword => device.label.toLowerCase().includes(keyword))
  );
  
  return nonFrontCamera || devices[0];
}

// بدء الماسح الضوئي مع التركيز على الكاميرا الخلفية
async function initializeScanner() {
  // ... (الكود السابق يبقى كما هو حتى بدء التشغيل)
  
  try {
    // المحاولة الأولى: استخدام facingMode للكاميرا الخلفية
    await html5QrCode.start(
      { facingMode: "environment" },
      config,
      handleScanSuccess,
      handleScanError
    );
    isScannerActive = true;
    checkFlashSupport();
  } catch (firstError) {
    console.log("فشل بدء التشغيل بـ facingMode، جارٍ المحاولة بقائمة الأجهزة...", firstError);
    
    // المحاولة الثانية: البحث اليدوي عن الكاميرا الخلفية
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length) {
        const backCamera = findBackCamera(devices);
        currentCameraId = backCamera ? backCamera.id : devices[0].id;
        
        await html5QrCode.start(
          currentCameraId,
          config,
          handleScanSuccess,
          handleScanError
        );
        
        isScannerActive = true;
        checkFlashSupport();
      } else {
        throw new Error("No cameras found");
      }
    } catch (secondError) {
      console.error("خطأ في تهيئة الماسح:", secondError);
      handleScanError(secondError);
    }
  }
}
