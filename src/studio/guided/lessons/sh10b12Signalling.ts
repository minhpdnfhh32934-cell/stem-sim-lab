import type { StudioScenario } from '../../scenario';
import { GUIDED_BASE, L } from './base';

/**
 * SH10 KNTT Bài 12 "Truyền tin tế bào" (printed pages 73–77), in SimLab's own words. Checked
 * against the pages on 16/11/2026: four ways between cells (trực tiếp, cận tiết, nội tiết, qua
 * synapse) and three stages inside the cell (tiếp nhận, truyền tín hiệu, đáp ứng). The prediction
 * uses the book's own example of endocrine signalling (H 12.1c, p. 73: a hormone released into
 * the blood reaches distant target cells); no example from outside the lesson. SH10-GL-2.
 */
export const sh10b12Signalling: StudioScenario = {
  ...GUIDED_BASE,
  id: 'guided.sh10-cell-signalling',
  topic: 'cellSignalling',
  title: L(
    'Truyền tin tế bào: tín hiệu đi từ tế bào này đến tế bào khác thế nào?',
    'Cell signalling: how does a signal travel from one cell to another?',
  ),
  objectives: [
    L(
      'Dự đoán một hormone theo máu tới tế bào ở xa là cách truyền tin nào.',
      'Predict which kind of signalling a hormone carried by the blood to distant cells is.',
    ),
    L(
      'Xếp đúng thứ tự các bước truyền tin vào trong một tế bào.',
      'Put the steps of signalling into a cell in the right order.',
    ),
    L(
      'Ghép mỗi cách truyền tin giữa các tế bào với đường đi của tín hiệu.',
      'Match each way cells signal to each other with the path the signal takes.',
    ),
  ],
  hints: [
    L(
      'Để ý tín hiệu phải đi xa hay gần, và nó đi bằng con đường nào.',
      'Notice whether the signal travels far or near, and by which route.',
    ),
    L(
      'Truyền tin trong tế bào có ba giai đoạn: tiếp nhận, truyền tín hiệu và đáp ứng.',
      'Signalling inside a cell has three stages: reception, transduction and response.',
    ),
  ],
  questions: [
    L(
      'Vì sao một hormone theo máu đi khắp cơ thể nhưng chỉ một số tế bào đáp ứng với nó?',
      'Why does a hormone carried all over the body by the blood make only some cells respond?',
    ),
  ],
  expectedConclusion: L(
    'Các tế bào truyền tin cho nhau bằng nhiều cách: trực tiếp, cận tiết, nội tiết và qua synapse. Hormone được tiết vào máu và theo máu đến những tế bào đích ở xa nên đó là truyền tin nội tiết. Trong tế bào nhận, tín hiệu đi qua ba giai đoạn: tiếp nhận (thụ thể gắn với tín hiệu), truyền tín hiệu (các phân tử lần lượt được hoạt hóa) và đáp ứng.',
    'Cells signal to each other in several ways: direct contact, paracrine, endocrine and through a synapse. A hormone released into the blood travels to distant target cells, so it is endocrine signalling. In the receiving cell the signal goes through three stages: reception (a receptor binds the signal), transduction (molecules are switched on one after another) and response.',
  ),
  sources: [],
  assumptions: [
    L(
      'Bài chỉ nói về tín hiệu hóa học, loại tín hiệu chủ yếu mà các tế bào truyền cho nhau.',
      'The lesson covers only chemical signals, the main kind of signal cells send each other.',
    ),
  ],
  limits: [
    L(
      'Bài chỉ nêu bốn cách truyền tin chủ yếu giữa các tế bào trong cơ thể đa bào, như sách giáo khoa.',
      'The lesson names only the four main ways cells of a multicellular body signal to each other, as the textbook does.',
    ),
  ],
  binding: {
    kind: 'guided',
    kntt: { book: 'SH10', lesson: 12 },
    question: L(
      'Một tế bào tiết hormone vào máu, rồi máu đưa hormone tới những tế bào đích ở xa nơi tiết ra. Theo em, đây là cách truyền tin nào?',
      'A cell releases a hormone into the blood, and the blood carries it to target cells far from where it was released. Which kind of signalling do you think this is?',
    ),
    choices: [
      { id: 'truc-tiep', text: L('Truyền tin trực tiếp', 'Direct signalling') },
      { id: 'can-tiet', text: L('Truyền tin cận tiết', 'Paracrine signalling') },
      { id: 'noi-tiet', text: L('Truyền tin nội tiết', 'Endocrine signalling') },
      { id: 'synapse', text: L('Truyền tin qua synapse', 'Signalling through a synapse') },
    ],
    answer: 'noi-tiet',
    answerWhy: L(
      'Hormone được tiết vào máu và theo máu tới những tế bào đích ở xa: đó là truyền tin nội tiết. Cận tiết chỉ tới tế bào ở gần, trực tiếp cần hai tế bào nằm sát nhau, còn synapse là khe giữa tế bào thần kinh và tế bào đích.',
      'The hormone is released into the blood and carried to target cells far away: that is endocrine signalling. Paracrine reaches only nearby cells, direct signalling needs two cells side by side, and a synapse is the gap between a nerve cell and its target.',
    ),
    activities: [
      {
        kind: 'order',
        id: 'giai-doan',
        prompt: L(
          'Xếp các bước truyền tin vào trong một tế bào theo đúng thứ tự.',
          'Put the steps of signalling into a cell in the right order.',
        ),
        items: [
          {
            id: 'phat',
            text: L(
              'Một tế bào khác phát tán phân tử tín hiệu',
              'Another cell sends out a signal molecule',
            ),
            why: L(
              'Tín hiệu (ví dụ một hormone) phải được phát ra trước thì tế bào nhận mới có gì để tiếp nhận.',
              'The signal (for example a hormone) must be sent first, or the receiving cell has nothing to receive.',
            ),
          },
          {
            id: 'tiep-nhan',
            text: L(
              'Phân tử tín hiệu gắn vào protein thụ thể của tế bào nhận',
              'The signal molecule binds a receptor protein of the receiving cell',
            ),
            why: L(
              'Đây là giai đoạn tiếp nhận: mỗi thụ thể chỉ khớp với tín hiệu phù hợp, như chìa khóa với ổ khóa, và thụ thể đổi hình dạng.',
              'This is reception: each receptor fits only its own signal, like a key in a lock, and the receptor changes shape.',
            ),
          },
          {
            id: 'truyen',
            text: L(
              'Thụ thể đã hoạt động lần lượt hoạt hóa các phân tử tiếp theo trong tế bào',
              'The active receptor switches on the next molecules in the cell, one after another',
            ),
            why: L(
              'Đây là giai đoạn truyền tín hiệu: tín hiệu được chuyển đổi qua một chuỗi phân tử, mỗi phân tử chuyển từ không hoạt động sang hoạt động.',
              'This is transduction: the signal is relayed along a chain of molecules, each switching from inactive to active.',
            ),
          },
          {
            id: 'dich',
            text: L(
              'Tín hiệu đến phân tử đích ở cuối chuỗi',
              'The signal reaches the target molecule at the end of the chain',
            ),
            why: L(
              'Chuỗi chuyển đổi kết thúc ở phân tử đích; chính phân tử này gây ra đáp ứng.',
              'The relay ends at the target molecule; this molecule brings about the response.',
            ),
          },
          {
            id: 'dap-ung',
            text: L(
              'Tế bào đáp ứng: bật hoặc tắt gene, đổi hoạt động, hình dạng, hoặc phân chia',
              'The cell responds: genes turn on or off, activity or shape changes, or the cell divides',
            ),
            why: L(
              'Đây là giai đoạn đáp ứng, kết quả cuối cùng của việc truyền tin.',
              'This is the response, the end result of the signalling.',
            ),
          },
        ],
      },
      {
        kind: 'match',
        id: 'cach-truyen',
        prompt: L(
          'Ghép mỗi cách truyền tin giữa các tế bào với đường đi của tín hiệu.',
          'Match each way cells signal to each other with the path the signal takes.',
        ),
        pairs: [
          {
            id: 'truc-tiep',
            left: L('Truyền tin trực tiếp', 'Direct signalling'),
            right: L(
              'Qua chỗ nối giữa hai tế bào nằm sát nhau',
              'Through a junction between two cells side by side',
            ),
            why: L(
              'Màng của hai tế bào cạnh nhau có chỗ nối hở, tín hiệu đi thẳng từ tế bào này sang tế bào kia.',
              'Two neighbouring cells have open junctions in their membranes, so the signal passes straight from one to the other.',
            ),
          },
          {
            id: 'can-tiet',
            left: L('Truyền tin cận tiết', 'Paracrine signalling'),
            right: L(
              'Tế bào tiết tín hiệu tới các tế bào ở gần',
              'A cell releases the signal to cells nearby',
            ),
            why: L(
              'Tín hiệu chỉ đi một đoạn ngắn tới các tế bào lân cận, không cần theo máu.',
              'The signal travels only a short way to neighbouring cells, without the blood.',
            ),
          },
          {
            id: 'noi-tiet',
            left: L('Truyền tin nội tiết', 'Endocrine signalling'),
            right: L(
              'Hormone vào máu, theo máu tới tế bào đích ở xa',
              'A hormone enters the blood and reaches target cells far away',
            ),
            why: L(
              'Nhờ dòng máu, tín hiệu tới được những tế bào đích rất xa nơi tiết ra.',
              'The blood stream lets the signal reach target cells very far from where it was released.',
            ),
          },
          {
            id: 'synapse',
            left: L('Truyền tin qua synapse', 'Signalling through a synapse'),
            right: L(
              'Chất dẫn truyền thần kinh đi qua khe nhỏ giữa tế bào thần kinh và tế bào đích',
              'A neurotransmitter crosses the small gap between a nerve cell and its target',
            ),
            why: L(
              'Khe nhỏ đó gọi là synapse; tín hiệu ở đây là chất dẫn truyền thần kinh.',
              'That small gap is the synapse; the signal there is a neurotransmitter.',
            ),
          },
        ],
      },
    ],
  },
};
