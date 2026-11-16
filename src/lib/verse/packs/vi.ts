import type { LanguagePack } from './index';

// Vietnamese. Each written word is a syllable; power words of two syllables must appear as written.
// Acrostic lines are keyed by the folded first letter (ơ under o, â under a).
const pack: LanguagePack = {
  lang: 'vi',
  acrostic: ['thơ', 'vua', 'hoa', 'sao', 'tình', 'mây'],
  forbidden: ['t', 'c', 'm', 'l', 'đ', 'u'],
  relics: {
    'RL-001': ['đầu lâu', 'trò hề', 'nấm mồ', 'tiếng cười', 'cát bụi'],
    'RL-002': ['bão tố', 'bùa chú', 'cây gậy', 'hòn đảo', 'chết chìm'],
    'RL-003': ['dao găm', 'máu', 'giấc ngủ', 'ảo ảnh', 'bàn tay'],
    'RL-004': ['chiếc nhẫn', 'lời thề', 'đêm', 'lưu đày', 'nụ hôn'],
    'RL-005': ['vàng', 'lựa chọn', 'khoan dung', 'chì', 'chiếc hộp'],
    'RL-006': ['vương miện', 'ngai vàng', 'tham vọng', 'phù thuỷ', 'nhà vua'],
    'RL-007': ['cuốn sách', 'bão tố', 'phép thuật', 'trang giấy', 'chết chìm'],
    'RL-008': ['nước mắt', 'sự thật', 'con gái', 'hư không', 'trái tim'],
    'RL-009': ['mặt nạ', 'giấc mơ', 'thằng hề', 'vở kịch', 'vầng trăng'],
  },
  written: {
    couplet: [
      'Thơ ngươi là nến tàn trong đêm tối\nThơ ta là mặt trời, ngươi lạc lối',
      'Bước lên đi, kép hát nghèo, khoe mẽ một giờ\nRồi nhìn thơ ngươi héo úa, bơ vơ',
    ],
    'quatrain-aabb': [
      'Ngươi mang đến chút tài mọn đi vay\nRồi lạ sao chẳng đòn nào trúng hôm nay\nTa từng gặp vua và hề trên sân khấu\nNgươi chỉ là dòng chú thích không ai thấu',
      'Khán giả đến để xem một trận đấu\nMà thơ ngươi toàn cơm thừa canh xấu\nNói nữa đi, to hơn, nếu ngươi dám\nTa đáp lời bão giông; ngươi là mây xám',
    ],
    'quatrain-abab': [
      'Ta bước trên sàn này khi ngươi còn bò\nThơ ta là luật, thơ ngươi là tiếng động\nGiờ nghe màn hạ, nến tắt, hết trò\nSân khấu cần anh hùng, không cần ảo mộng',
      'Thơ ngươi khập khiễng bước vào một chân\nXin khán giả rủ chút lòng thương hại\nTa chẳng đá kẻ đã ngã xuống sân\nTa chỉ để hắn ngồi đó mà ngẫm lại',
    ],
    tercet: [
      'Ngươi có cái lưỡi, ta công nhận, nhưng thiếu tài\nNó lang thang như gã say trong bóng tối\nVà chẳng bao giờ chạm được trái tim ai',
      'Gọi đó là thơ ư? Ta gọi là sai lầm\nMột dòng què quặt đang xin được yên nghỉ\nVà ta rộng lượng ban cho, với trọn thiện tâm',
    ],
    anaphora: [
      'Chưa bao giờ ta nghe nói nhiều đến thế về điều nhỏ đến thế\nChưa sân khấu nào phải chịu một giọng mỏng đến vậy\nChưa chắc khán giả này còn muốn nghe ngươi lần nữa',
      'Nói đi, và nến nghiêng mình tránh xa ngươi\nNói đi, và khán giả đếm lối ra\nNói đi, rồi ta sẽ đáp khi đáng đáp',
    ],
    crescendo: [
      'Ngươi nhỏ bé\nThơ ngươi còn nhỏ bé hơn\nCòn ta đã nghiền nát bao thứ lớn hơn ngươi nhiều trước bữa sáng',
      'Nghe đây\nĐêm nay sân khấu thuộc về ta\nVà mỗi lời thốt ra từ miệng ngươi là thêm một chiếc đinh đóng vào thất bại',
    ],
    epistrophe: [
      'Ngươi đến để thắng và gặp sân khấu\nNgươi nói một lần và mất sân khấu\nGiờ cúi chào đi, nhường ta sân khấu',
      'Ta cho ngươi mượn tai, ngươi phí thời gian\nVần ngươi cạn khô trước cả thời gian\nGiờ ngươi chỉ còn biết giết thời gian',
    ],
    haiku: [
      'Thơ ngươi rơi như lá\nChẳng ai buồn cúi xuống nhặt lên\nGió cuốn đi tất cả',
      'Một giọng nói xa xăm\nTa ngoảnh đầu lại để lắng nghe\nHoá ra là tiếng gió',
    ],
    'heroic-couplet': [
      'Thơ ngươi chỉ là chiếc bóng in trên vách đá\nThơ ta là ngọn lửa, soi rõ từng kẽ lá',
      'Ta đến đây buôn sấm sét và lửa hồng\nCòn ngươi mang cây nến nhỏ, có cũng như không',
    ],
    'luc-bat': [
      'Thơ ngươi như ngọn nến tàn\nGió đưa một thoáng, muôn vàn khói bay',
      'Lên đi, khoe giọng một giờ\nRồi nghe sân khấu hững hờ gọi ta',
    ],
  },
  acrosticLines: {
    t: ['Ta vẫn đứng đây, còn ngươi vẫn chờ thua', 'Tối nay sân khấu chỉ nhớ tên ta'],
    h: ['Hãy về đi, cửa vẫn còn đang mở', 'Hỡi ôi, vần ngươi lại đến muộn rồi'],
    o: ['Ồn ào đâu phải là hay, bạn ạ', 'Ôi, lại thêm một lần ngươi mở miệng uổng công'],
    v: ['Vua chúa còn thua ta; ngươi là ai?', 'Vần là lưỡi kiếm, mà ngươi mang theo cái thìa'],
    u: ['Uổng cho một giọng to mà thơ thì nhỏ', 'Ước gì ngươi im lặng sớm hơn'],
    a: ['Ai còn nghe ngươi khi nến đã quay đi?', 'Âm thanh ấy ư? À, là tiếng ngươi thua'],
    s: ['Sân khấu này chưa từng lặng đến thế vì ngươi', 'Sao ngươi còn đứng đó, màn đã hạ rồi'],
    i: ['Im đi, và nghe một câu thơ ra hồn', 'Ít lời thôi, ngươi chẳng còn mấy chữ'],
    n: ['Này, bài học đến đây là hết; mang về đi', 'Ngươi nói nhiều mà chẳng nói được gì'],
    m: ['Mỗi câu của ngươi đều chết giữa không trung', 'Mau quỳ xuống, phán quyết đã tuyên rồi'],
    y: ['Yếu ớt thay một vần thơ như thế', 'Yên lặng nào, để câu thơ thật cất lời'],
  },
};

export default pack;
