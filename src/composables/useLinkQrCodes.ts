import QRCode from 'qrcode'
import { ref, watch, type Ref } from 'vue'

export function useLinkQrCodes(displayLink: Readonly<Ref<string>>, controllerLink: Readonly<Ref<string>>) {
  const displayQrDataUrl = ref('')
  const controllerQrDataUrl = ref('')

  async function refreshQrCodes() {
    try {
      const [displayQr, controllerQr] = await Promise.all([
        QRCode.toDataURL(displayLink.value, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 220,
        }),
        QRCode.toDataURL(controllerLink.value, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 220,
        }),
      ])

      displayQrDataUrl.value = displayQr
      controllerQrDataUrl.value = controllerQr
    } catch {
      displayQrDataUrl.value = ''
      controllerQrDataUrl.value = ''
    }
  }

  watch([displayLink, controllerLink], () => {
    void refreshQrCodes()
  }, { immediate: true })

  return {
    displayQrDataUrl,
    controllerQrDataUrl,
  }
}
