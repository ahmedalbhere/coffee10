async function initializeScanner() {
  if (isScannerActive) return;
  
  // تنظيف الماسح السابق إذا كان موجوداً
  if (html5QrCode && html5QrCode.isScanning) {
    await html5QrCode.stop().catch(console.error);
  }

  html5QrCode = new Html5Qrcode("scanner");
  
  const config = {
    fps: 30,
    qrbox: { width: 250, height: 250 },
    rememberLastUsedCamera: true,
    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
    formatsToSupport: [
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.AZTEC,
      Html5QrcodeSupportedFormats.DATA_MATRIX,
      Html5QrcodeSupportedFormats.PDF_417
    ]
  };

  try {
    const devices = await Html5Qrcode.getCameras();
    if (devices && devices.length) {
      // البحث عن الكاميرا الخلفية فقط
      const backCamera = devices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') || 
        device.label.toLowerCase().includes('1')
      );
      
      if (backCamera) {
        currentCameraId = backCamera.id;
        
        await html5QrCode.start(
          currentCameraId,
          config,
          handleScanSuccess,
          handleScanError
        );
        
        isScannerActive = true;
        
        // التحقق من دعم الفلاش
        checkFlashSupport();
      } else {
        // إذا لم يتم العثور على كاميرا خلفية، نوقف الماسح ونظهر رسالة
        alert("لا توجد كاميرا خلفية متاحة. الرجاء التأكد من وجود كاميرا خلفية وتوصيلها بشكل صحيح.");
        document.querySelector('.fallback-input').style.display = 'block';
        isScannerActive = false;
      }
    } else {
      throw new Error("No cameras found");
    }
  } catch (error) {
    console.error("Scanner initialization error:", error);
    handleScanError(error);
  }
}
