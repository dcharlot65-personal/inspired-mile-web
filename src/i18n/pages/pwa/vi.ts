// Tiếng Việt. Nút của Apple (Chia sẻ, “Thêm vào Màn hình chính”) và của Android (Cài đặt, Để sau) theo đúng chữ của họ. Xưng “bạn”.
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Cài đặt Sonnet Man',
  'pwa.install.title': 'Hãy cài đặt Sonnet Man trước',
  'pwa.install.promptBody': 'Ứng dụng mở toàn màn hình, và với ứng dụng đã cài đặt, khả năng trình duyệt xóa mô hình đã tải thấp hơn nhiều.',
  'pwa.install.iosBody': 'Trên iPhone và iPad, ứng dụng ở Màn hình chính không dùng chung gì với thẻ này. Hãy thêm nó trước khi đăng nhập hoặc tải mô hình, nếu không bạn sẽ phải làm cả hai việc hai lần.',
  'pwa.install.iosStep1': 'Chạm vào nút Chia sẻ.',
  'pwa.install.iosStep2': 'Chọn “Thêm vào Màn hình chính”.',
  'pwa.install.accept': 'Cài đặt',
  'pwa.install.dismiss': 'Để sau',
  'pwa.storage.kept': 'Đã giữ {size} trên thiết bị này. Trình duyệt sẽ không tự xóa.',
  'pwa.storage.keptNoSize': 'Dữ liệu bạn tải được giữ trên thiết bị này. Trình duyệt sẽ không tự xóa.',
  'pwa.storage.atRisk': 'Đã lưu {size}, nhưng trình duyệt có thể xóa nếu thiết bị hết dung lượng hoặc bạn không quay lại trong một thời gian.',
  'pwa.storage.atRiskNoSize': 'Dữ liệu bạn tải đã được lưu, nhưng trình duyệt có thể xóa nếu thiết bị hết dung lượng hoặc bạn không quay lại trong một thời gian.',
  'pwa.storage.installHint': 'Cài đặt ứng dụng giúp giữ lại dữ liệu.',
  'pwa.storage.lessThan': 'chưa đến {size}',
};

export default messages;
